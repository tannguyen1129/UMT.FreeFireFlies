import {
  Injectable,
  Logger,
  OnApplicationBootstrap,
  OnApplicationShutdown,
} from '@nestjs/common';
import { HttpService } from '@nestjs/axios';
import { ConfigService } from '@nestjs/config';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository } from 'typeorm';
import { AQGridPoint } from './entities/aq-grid-point.entity';
import { AirQualityObservation } from './entities/air-quality-observation.entity';
import { WeatherObservation } from './entities/weather-observation.entity';
import {
  loadResearchGridConfig,
  ResearchGridConfig,
  ResearchGridPointConfig,
} from './config/research-grid';

type CollectionSource = 'air_quality' | 'weather';

interface SourceHealthState {
  running: boolean;
  lastStartedAt: string | null;
  lastCompletedAt: string | null;
  lastSuccessfulAt: string | null;
  lastError: string | null;
  successfulGridPoints: number;
  failedGridPoints: number;
  totalFailures: number;
}

interface CollectionResult {
  successful: number;
  failed: number;
}

const NGSI_LD_CONTEXT = [
  'https://smartdatamodels.org/context.jsonld',
  'https://uri.etsi.org/ngsi-ld/v1/ngsi-ld-core-context-v1.7.jsonld',
];

@Injectable()
export class ResearchCollectorService
  implements OnApplicationBootstrap, OnApplicationShutdown
{
  private readonly logger = new Logger(ResearchCollectorService.name);
  private readonly enabled: boolean;
  private readonly grid: ResearchGridConfig;
  private readonly owmApiKey: string;
  private readonly owmAirUrl: string;
  private readonly owmWeatherUrl: string;
  private readonly orionEntitiesUrl: string;
  private readonly aqIntervalMs: number;
  private readonly weatherIntervalMs: number;
  private readonly requestTimeoutMs: number;
  private readonly maxRetries: number;
  private readonly concurrency: number;
  private readonly batchDelayMs: number;
  private readonly shutdownController = new AbortController();
  private aqTimer?: NodeJS.Timeout;
  private weatherTimer?: NodeJS.Timeout;
  private aqCycle?: Promise<void>;
  private weatherCycle?: Promise<void>;
  private shuttingDown = false;

  private readonly health: Record<CollectionSource, SourceHealthState> = {
    air_quality: this.newHealthState(),
    weather: this.newHealthState(),
  };

  constructor(
    @InjectRepository(AQGridPoint)
    private readonly gridPointRepository: Repository<AQGridPoint>,
    @InjectRepository(AirQualityObservation)
    private readonly airQualityRepository: Repository<AirQualityObservation>,
    @InjectRepository(WeatherObservation)
    private readonly weatherRepository: Repository<WeatherObservation>,
    private readonly httpService: HttpService,
    private readonly configService: ConfigService,
  ) {
    this.enabled = this.configService.get<string>('RESEARCH_COLLECTOR_ENABLED', 'false') === 'true';
    this.owmApiKey = this.requiredConfig('OWM_API_KEY');
    this.owmAirUrl = this.configService.get<string>(
      'OWM_AIR_URL',
      'https://api.openweathermap.org/data/2.5/air_pollution',
    );
    this.owmWeatherUrl = this.configService.get<string>(
      'OWM_WEATHER_URL',
      'https://api.openweathermap.org/data/2.5/weather',
    );
    this.orionEntitiesUrl = this.requiredConfig('ORION_LD_URL');
    this.grid = loadResearchGridConfig(
      this.configService.get<string>('RESEARCH_GRID_PATH', 'config/research-grid.json'),
    );
    this.aqIntervalMs = this.minutesConfig('AQ_COLLECTION_INTERVAL_MINUTES', 15) * 60_000;
    this.weatherIntervalMs = this.minutesConfig('WEATHER_COLLECTION_INTERVAL_MINUTES', 15) * 60_000;
    this.requestTimeoutMs = this.integerConfig('COLLECTOR_REQUEST_TIMEOUT_MS', 10_000, 1_000, 60_000);
    this.maxRetries = this.integerConfig('COLLECTOR_MAX_RETRIES', 3, 0, 6);
    this.concurrency = this.integerConfig('COLLECTOR_CONCURRENCY', 2, 1, 5);
    this.batchDelayMs = this.integerConfig('COLLECTOR_BATCH_DELAY_MS', 1_000, 0, 30_000);
  }

  async onApplicationBootstrap(): Promise<void> {
    if (!this.enabled) {
      this.log('log', 'collector_disabled', { source: 'research' });
      return;
    }

    await this.seedGridPoints();
    this.log('log', 'collector_started', {
      source: 'research',
      grid_version: this.grid.version,
      grid_points: this.grid.points.length,
      aq_interval_minutes: this.aqIntervalMs / 60_000,
      weather_interval_minutes: this.weatherIntervalMs / 60_000,
      concurrency: this.concurrency,
    });

    this.aqTimer = setInterval(() => this.startCycle('air_quality'), this.aqIntervalMs);
    this.weatherTimer = setInterval(() => this.startCycle('weather'), this.weatherIntervalMs);
    this.startCycle('air_quality');
    this.startCycle('weather');
  }

  async onApplicationShutdown(signal?: string): Promise<void> {
    this.shuttingDown = true;
    if (this.aqTimer) clearInterval(this.aqTimer);
    if (this.weatherTimer) clearInterval(this.weatherTimer);
    this.shutdownController.abort();
    await Promise.allSettled([this.aqCycle, this.weatherCycle].filter(Boolean));
    this.log('log', 'collector_stopped', { source: 'research', signal: signal ?? 'application' });
  }

  getHealthState() {
    return {
      enabled: this.enabled,
      shuttingDown: this.shuttingDown,
      gridVersion: this.grid.version,
      gridPoints: this.grid.points.length,
      airQuality: { ...this.health.air_quality },
      weather: { ...this.health.weather },
    };
  }

  private startCycle(source: CollectionSource): void {
    if (this.shuttingDown || this.health[source].running) {
      if (!this.shuttingDown) this.log('warn', 'collection_overlap_skipped', { source });
      return;
    }

    const cycle = this.runCycle(source).finally(() => {
      if (source === 'air_quality') this.aqCycle = undefined;
      else this.weatherCycle = undefined;
    });
    if (source === 'air_quality') this.aqCycle = cycle;
    else this.weatherCycle = cycle;
  }

  private async runCycle(source: CollectionSource): Promise<void> {
    const state = this.health[source];
    state.running = true;
    state.lastStartedAt = new Date().toISOString();
    state.lastError = null;
    this.log('log', 'collection_started', { source, grid_points: this.grid.points.length });

    try {
      const result = await this.collectInBatches(source);
      state.successfulGridPoints = result.successful;
      state.failedGridPoints = result.failed;
      state.totalFailures += result.failed;
      state.lastCompletedAt = new Date().toISOString();
      if (result.successful > 0) state.lastSuccessfulAt = state.lastCompletedAt;
      if (result.failed > 0) state.lastError = `${result.failed} grid point(s) failed`;
      this.log(result.failed === 0 ? 'log' : 'warn', 'collection_completed', {
        source,
        successful_grid_points: result.successful,
        failed_grid_points: result.failed,
      });
    } catch (error) {
      state.lastCompletedAt = new Date().toISOString();
      state.lastError = this.errorType(error);
      state.totalFailures += this.grid.points.length;
      this.log('error', 'collection_failed', { source, error_type: this.errorType(error) });
    } finally {
      state.running = false;
    }
  }

  private async collectInBatches(source: CollectionSource): Promise<CollectionResult> {
    const result: CollectionResult = { successful: 0, failed: 0 };
    for (let offset = 0; offset < this.grid.points.length; offset += this.concurrency) {
      if (this.shuttingDown) break;
      const batch = this.grid.points.slice(offset, offset + this.concurrency);
      const settled = await Promise.allSettled(
        batch.map((point) =>
          source === 'air_quality'
            ? this.collectAirQualityPoint(point)
            : this.collectWeatherPoint(point),
        ),
      );

      for (const item of settled) {
        if (item.status === 'fulfilled') result.successful += 1;
        else result.failed += 1;
      }

      if (offset + this.concurrency < this.grid.points.length && this.batchDelayMs > 0) {
        await this.wait(this.batchDelayMs);
      }
    }
    return result;
  }

  private async collectAirQualityPoint(point: ResearchGridPointConfig): Promise<void> {
    try {
      const response = await this.requestWithRetry('air_quality', point, this.owmAirUrl);
      const upstreamObservation = response.data?.list?.[0];
      if (!upstreamObservation?.dt || !upstreamObservation?.components) {
        throw new Error('invalid_upstream_payload');
      }
      const gridPoint = await this.findGridPoint(point.id);
      const sourceObservedAt = new Date(upstreamObservation.dt * 1_000);

      await this.airQualityRepository.upsert(
        {
          gridPointId: gridPoint.id,
          source: this.grid.source,
          sourceObservedAt,
          aqi: upstreamObservation.main?.aqi ?? null,
          pm2_5: upstreamObservation.components.pm2_5 ?? null,
          pm10: upstreamObservation.components.pm10 ?? null,
          co: upstreamObservation.components.co ?? null,
          no: upstreamObservation.components.no ?? null,
          no2: upstreamObservation.components.no2 ?? null,
          o3: upstreamObservation.components.o3 ?? null,
          so2: upstreamObservation.components.so2 ?? null,
          nh3: upstreamObservation.components.nh3 ?? null,
          rawPayload: response.data,
        },
        ['source', 'gridPointId', 'sourceObservedAt'],
      );

      await this.syncOrionSafely('air_quality', point, {
        id: `urn:ngsi-ld:AirQualityObservation:OWM-${point.id}`,
        type: 'AirQualityObserved',
        location: this.ngsiLocation(point),
        dateObserved: this.ngsiDate(sourceObservedAt),
        aqi: this.ngsiProperty(upstreamObservation.main?.aqi),
        pm25: this.ngsiProperty(upstreamObservation.components.pm2_5, 'GQ'),
        pm10: this.ngsiProperty(upstreamObservation.components.pm10, 'GQ'),
        co: this.ngsiProperty(upstreamObservation.components.co, 'GQ'),
        no: this.ngsiProperty(upstreamObservation.components.no, 'GQ'),
        no2: this.ngsiProperty(upstreamObservation.components.no2, 'GQ'),
        o3: this.ngsiProperty(upstreamObservation.components.o3, 'GQ'),
        so2: this.ngsiProperty(upstreamObservation.components.so2, 'GQ'),
        nh3: this.ngsiProperty(upstreamObservation.components.nh3, 'GQ'),
        '@context': NGSI_LD_CONTEXT,
      });
    } catch (error) {
      this.log('error', 'grid_collection_failed', {
        source: 'air_quality',
        grid_point: point.id,
        error_type: this.errorType(error),
        http_status: this.httpStatus(error),
        retry_count: this.retryCount(error),
      });
      throw error;
    }
  }

  private async collectWeatherPoint(point: ResearchGridPointConfig): Promise<void> {
    try {
      const response = await this.requestWithRetry('weather', point, this.owmWeatherUrl, {
        units: 'metric',
      });
      if (!response.data?.dt || !response.data?.main) {
        throw new Error('invalid_upstream_payload');
      }
      const gridPoint = await this.findGridPoint(point.id);
      const sourceObservedAt = new Date(response.data.dt * 1_000);

      await this.weatherRepository.upsert(
        {
          gridPointId: gridPoint.id,
          source: this.grid.source,
          sourceObservedAt,
          temperature: response.data.main.temp ?? null,
          humidity: response.data.main.humidity ?? null,
          pressure: response.data.main.pressure ?? null,
          windSpeed: response.data.wind?.speed ?? null,
          windDirection: response.data.wind?.deg ?? null,
          clouds: response.data.clouds?.all ?? null,
          rain: response.data.rain?.['1h'] ?? response.data.rain?.['3h'] ?? null,
          rawPayload: response.data,
        },
        ['source', 'gridPointId', 'sourceObservedAt'],
      );

      await this.syncOrionSafely('weather', point, {
        id: `urn:ngsi-ld:WeatherObservation:OWM-${point.id}`,
        type: 'WeatherObserved',
        location: this.ngsiLocation(point),
        dateObserved: this.ngsiDate(sourceObservedAt),
        temperature: this.ngsiProperty(response.data.main.temp, 'CEL'),
        relativeHumidity: this.ngsiProperty(
          response.data.main.humidity == null ? null : response.data.main.humidity / 100,
        ),
        pressure: this.ngsiProperty(response.data.main.pressure, 'A97'),
        windSpeed: this.ngsiProperty(response.data.wind?.speed, 'MTS'),
        windDirection: this.ngsiProperty(response.data.wind?.deg),
        clouds: this.ngsiProperty(response.data.clouds?.all),
        rain: this.ngsiProperty(response.data.rain?.['1h'] ?? response.data.rain?.['3h'], 'MMT'),
        '@context': NGSI_LD_CONTEXT,
      });
    } catch (error) {
      this.log('error', 'grid_collection_failed', {
        source: 'weather',
        grid_point: point.id,
        error_type: this.errorType(error),
        http_status: this.httpStatus(error),
        retry_count: this.retryCount(error),
      });
      throw error;
    }
  }

  private async requestWithRetry(
    source: CollectionSource,
    point: ResearchGridPointConfig,
    url: string,
    extraParams: Record<string, string> = {},
  ): Promise<any> {
    for (let attempt = 0; ; attempt += 1) {
      try {
        return await this.httpService.axiosRef.get(url, {
          params: { lat: point.lat, lon: point.lon, appid: this.owmApiKey, ...extraParams },
          timeout: this.requestTimeoutMs,
          signal: this.shutdownController.signal,
        });
      } catch (error) {
        const status = this.httpStatus(error);
        const retryable = status === null || status === 429 || status >= 500;
        if (this.shuttingDown || !retryable || attempt >= this.maxRetries) {
          if (error && typeof error === 'object') error.collectorRetryCount = attempt;
          throw error;
        }

        const retryAfter = Number(error?.response?.headers?.['retry-after']);
        const delayMs = Number.isFinite(retryAfter)
          ? Math.max(retryAfter * 1_000, 1_000)
          : Math.min(1_000 * 2 ** attempt, 30_000);
        this.log('warn', 'upstream_retry', {
          source,
          grid_point: point.id,
          retry_count: attempt + 1,
          http_status: status,
          error_type: this.errorType(error),
          delay_ms: delayMs,
        });
        await this.wait(delayMs);
      }
    }
  }

  private async syncOrionSafely(
    source: CollectionSource,
    point: ResearchGridPointConfig,
    payload: Record<string, any>,
  ): Promise<void> {
    const cleanPayload = Object.fromEntries(
      Object.entries(payload).filter(([, value]) => {
        if (!value || typeof value !== 'object' || !('value' in value)) return true;
        return value.value !== undefined && value.value !== null;
      }),
    );
    try {
      await this.httpService.axiosRef.post(this.orionEntitiesUrl, cleanPayload, {
        headers: { 'Content-Type': 'application/ld+json' },
        timeout: this.requestTimeoutMs,
        signal: this.shutdownController.signal,
      });
    } catch (error) {
      if (this.httpStatus(error) === 409 || this.httpStatus(error) === 422) {
        const patchPayload = { ...cleanPayload };
        delete patchPayload.id;
        delete patchPayload.type;
        await this.httpService.axiosRef.patch(
          `${this.orionEntitiesUrl}/${encodeURIComponent(cleanPayload.id)}/attrs`,
          patchPayload,
          {
            headers: { 'Content-Type': 'application/ld+json' },
            timeout: this.requestTimeoutMs,
            signal: this.shutdownController.signal,
          },
        );
        return;
      }

      this.log('warn', 'orion_sync_failed', {
        source,
        grid_point: point.id,
        http_status: this.httpStatus(error),
        error_type: this.errorType(error),
        postgres_record_preserved: true,
      });
    }
  }

  private async seedGridPoints(): Promise<void> {
    await this.gridPointRepository.upsert(
      this.grid.points.map((point) => ({
        code: point.id,
        name: point.name,
        latitude: point.lat,
        longitude: point.lon,
        source: this.grid.source,
        gridVersion: this.grid.version,
        active: true,
      })),
      ['code'],
    );
  }

  private async findGridPoint(code: string): Promise<AQGridPoint> {
    const point = await this.gridPointRepository.findOneBy({ code });
    if (!point) throw new Error(`grid_point_not_seeded:${code}`);
    return point;
  }

  private ngsiLocation(point: ResearchGridPointConfig) {
    return {
      type: 'GeoProperty',
      value: { type: 'Point', coordinates: [point.lon, point.lat] },
    };
  }

  private ngsiDate(date: Date) {
    return { type: 'Property', value: { '@type': 'DateTime', '@value': date.toISOString() } };
  }

  private ngsiProperty(value: any, unitCode?: string) {
    return { type: 'Property', value, ...(unitCode ? { unitCode } : {}) };
  }

  private requiredConfig(key: string): string {
    const value = this.configService.get<string>(key);
    if (!value) throw new Error(`${key} is required`);
    return value;
  }

  private minutesConfig(key: string, fallback: number): number {
    return this.integerConfig(key, fallback, 10, 60);
  }

  private integerConfig(
    key: string,
    fallback: number,
    minimum: number,
    maximum: number,
  ): number {
    const raw = this.configService.get<string>(key);
    const value = raw === undefined ? fallback : Number(raw);
    if (!Number.isInteger(value) || value < minimum || value > maximum) {
      throw new Error(`${key} must be an integer between ${minimum} and ${maximum}`);
    }
    return value;
  }

  private httpStatus(error: any): number | null {
    const status = Number(error?.response?.status);
    return Number.isInteger(status) ? status : null;
  }

  private errorType(error: any): string {
    return String(error?.code || error?.name || error?.message || 'unknown_error');
  }

  private retryCount(error: any): number {
    const count = Number(error?.collectorRetryCount);
    return Number.isInteger(count) ? count : 0;
  }

  private wait(milliseconds: number): Promise<void> {
    if (this.shutdownController.signal.aborted) return Promise.resolve();
    return new Promise((resolve) => {
      const finish = () => {
        clearTimeout(timer);
        this.shutdownController.signal.removeEventListener('abort', finish);
        resolve();
      };
      const timer = setTimeout(finish, milliseconds);
      this.shutdownController.signal.addEventListener('abort', finish, { once: true });
    });
  }

  private log(level: 'log' | 'warn' | 'error', event: string, context: Record<string, any>) {
    this.logger[level](JSON.stringify({ event, timestamp: new Date().toISOString(), ...context }));
  }

  private newHealthState(): SourceHealthState {
    return {
      running: false,
      lastStartedAt: null,
      lastCompletedAt: null,
      lastSuccessfulAt: null,
      lastError: null,
      successfulGridPoints: 0,
      failedGridPoints: 0,
      totalFailures: 0,
    };
  }
}
