import { Injectable } from '@nestjs/common';
import { HttpService } from '@nestjs/axios';
import { ConfigService } from '@nestjs/config';
import { DataSource } from 'typeorm';
import { Socket } from 'net';
import { ResearchCollectorService } from './research-collector.service';

interface ObservationMetricsRow {
  active_grid_points: string;
  latest_aq_source_observed_at: Date | null;
  latest_aq_ingested_at: Date | null;
  latest_weather_source_observed_at: Date | null;
  latest_weather_ingested_at: Date | null;
  aq_last_hour: string;
  aq_last_24_hours: string;
  weather_last_hour: string;
  weather_last_24_hours: string;
  stale_aq_grid_points: string;
  stale_weather_grid_points: string;
  missing_aq_grid_points: string;
  missing_weather_grid_points: string;
  duplicate_groups: string;
}

@Injectable()
export class ResearchHealthService {
  private readonly mongoHost: string;
  private readonly mongoPort: number;
  private readonly orionVersionUrl: string;
  private readonly dependencyTimeoutMs: number;
  private readonly staleAfterMinutes: number;

  constructor(
    private readonly dataSource: DataSource,
    private readonly httpService: HttpService,
    private readonly configService: ConfigService,
    private readonly collector: ResearchCollectorService,
  ) {
    this.mongoHost = this.configService.get<string>('MONGO_HOST', 'mongo');
    this.mongoPort = this.numberConfig('MONGO_PORT', 27017, 1, 65535);
    this.dependencyTimeoutMs = this.numberConfig(
      'HEALTH_DEPENDENCY_TIMEOUT_MS',
      3_000,
      500,
      30_000,
    );
    this.staleAfterMinutes = this.numberConfig(
      'HEALTH_STALE_AFTER_MINUTES',
      45,
      20,
      1_440,
    );
    const orionEntitiesUrl = this.configService.get<string>('ORION_LD_URL');
    if (!orionEntitiesUrl) throw new Error('ORION_LD_URL is required');
    this.orionVersionUrl = new URL('/version', orionEntitiesUrl).toString();
  }

  async inspect() {
    const collector = this.collector.getHealthState();
    const [database, mongodb, orionLd] = await Promise.all([
      this.databaseMetrics(collector.gridVersion),
      this.checkMongo(),
      this.checkOrion(),
    ]);
    const metrics = database.metrics;
    const dataHealthy = Boolean(
      metrics &&
        metrics.activeGridPoints === collector.gridPoints &&
        metrics.missingGridPoints.airQuality === 0 &&
        metrics.missingGridPoints.weather === 0 &&
        metrics.staleGridPoints.airQuality === 0 &&
        metrics.staleGridPoints.weather === 0 &&
        metrics.duplicateGroups === 0,
    );
    const dependenciesHealthy =
      database.status === 'ok' && mongodb.status === 'ok' && orionLd.status === 'ok';
    const collectorHealthy =
      collector.enabled &&
      !collector.shuttingDown &&
      collector.airQuality.lastSuccessfulAt !== null &&
      collector.weather.lastSuccessfulAt !== null;

    return {
      status: dependenciesHealthy && collectorHealthy && dataHealthy ? 'ok' : 'degraded',
      checkedAt: new Date().toISOString(),
      dependencies: {
        postgresql: { status: database.status, error: database.error },
        mongodb,
        orionLd,
      },
      collector,
      data: metrics,
      failedCollectionCount:
        collector.airQuality.totalFailures + collector.weather.totalFailures,
    };
  }

  private async databaseMetrics(gridVersion: string): Promise<{
    status: 'ok' | 'error';
    error: string | null;
    metrics: ReturnType<ResearchHealthService['mapMetrics']> | null;
  }> {
    try {
      const rows: ObservationMetricsRow[] = await this.dataSource.query(
        `
          WITH
          active_points AS (
            SELECT id FROM aq_grid_points WHERE active = true AND grid_version = $2
          ),
          aq_latest AS (
            SELECT grid_point_id, MAX(ingested_at) AS latest
            FROM air_quality_observations GROUP BY grid_point_id
          ),
          weather_latest AS (
            SELECT grid_point_id, MAX(ingested_at) AS latest
            FROM weather_observations GROUP BY grid_point_id
          ),
          duplicate_groups AS (
            SELECT 1 FROM air_quality_observations
            GROUP BY source, grid_point_id, source_observed_at HAVING COUNT(*) > 1
            UNION ALL
            SELECT 1 FROM weather_observations
            GROUP BY source, grid_point_id, source_observed_at HAVING COUNT(*) > 1
          )
          SELECT
            (SELECT COUNT(*) FROM active_points) AS active_grid_points,
            (SELECT MAX(o.source_observed_at) FROM air_quality_observations o JOIN active_points p ON p.id = o.grid_point_id) AS latest_aq_source_observed_at,
            (SELECT MAX(o.ingested_at) FROM air_quality_observations o JOIN active_points p ON p.id = o.grid_point_id) AS latest_aq_ingested_at,
            (SELECT MAX(o.source_observed_at) FROM weather_observations o JOIN active_points p ON p.id = o.grid_point_id) AS latest_weather_source_observed_at,
            (SELECT MAX(o.ingested_at) FROM weather_observations o JOIN active_points p ON p.id = o.grid_point_id) AS latest_weather_ingested_at,
            (SELECT COUNT(*) FROM air_quality_observations o JOIN active_points p ON p.id = o.grid_point_id WHERE o.ingested_at >= NOW() - INTERVAL '1 hour') AS aq_last_hour,
            (SELECT COUNT(*) FROM air_quality_observations o JOIN active_points p ON p.id = o.grid_point_id WHERE o.ingested_at >= NOW() - INTERVAL '24 hours') AS aq_last_24_hours,
            (SELECT COUNT(*) FROM weather_observations o JOIN active_points p ON p.id = o.grid_point_id WHERE o.ingested_at >= NOW() - INTERVAL '1 hour') AS weather_last_hour,
            (SELECT COUNT(*) FROM weather_observations o JOIN active_points p ON p.id = o.grid_point_id WHERE o.ingested_at >= NOW() - INTERVAL '24 hours') AS weather_last_24_hours,
            (SELECT COUNT(*) FROM active_points p JOIN aq_latest l ON l.grid_point_id = p.id
              WHERE l.latest < NOW() - make_interval(mins => $1::int)) AS stale_aq_grid_points,
            (SELECT COUNT(*) FROM active_points p JOIN weather_latest l ON l.grid_point_id = p.id
              WHERE l.latest < NOW() - make_interval(mins => $1::int)) AS stale_weather_grid_points,
            (SELECT COUNT(*) FROM active_points p LEFT JOIN aq_latest l ON l.grid_point_id = p.id
              WHERE l.grid_point_id IS NULL) AS missing_aq_grid_points,
            (SELECT COUNT(*) FROM active_points p LEFT JOIN weather_latest l ON l.grid_point_id = p.id
              WHERE l.grid_point_id IS NULL) AS missing_weather_grid_points,
            (SELECT COUNT(*) FROM duplicate_groups) AS duplicate_groups
        `,
        [this.staleAfterMinutes, gridVersion],
      );
      return { status: 'ok', error: null, metrics: this.mapMetrics(rows[0]) };
    } catch (error) {
      return { status: 'error', error: this.errorType(error), metrics: null };
    }
  }

  private mapMetrics(row: ObservationMetricsRow) {
    return {
      activeGridPoints: Number(row.active_grid_points),
      latestAirQuality: {
        sourceObservedAt: this.iso(row.latest_aq_source_observed_at),
        ingestedAt: this.iso(row.latest_aq_ingested_at),
      },
      latestWeather: {
        sourceObservedAt: this.iso(row.latest_weather_source_observed_at),
        ingestedAt: this.iso(row.latest_weather_ingested_at),
      },
      recordsLastHour: {
        airQuality: Number(row.aq_last_hour),
        weather: Number(row.weather_last_hour),
      },
      recordsLast24Hours: {
        airQuality: Number(row.aq_last_24_hours),
        weather: Number(row.weather_last_24_hours),
      },
      staleGridPoints: {
        airQuality: Number(row.stale_aq_grid_points),
        weather: Number(row.stale_weather_grid_points),
      },
      missingGridPoints: {
        airQuality: Number(row.missing_aq_grid_points),
        weather: Number(row.missing_weather_grid_points),
      },
      duplicateGroups: Number(row.duplicate_groups),
      staleAfterMinutes: this.staleAfterMinutes,
    };
  }

  private async checkMongo(): Promise<{ status: 'ok' | 'error'; error: string | null }> {
    return new Promise((resolve) => {
      const socket = new Socket();
      let settled = false;
      const finish = (status: 'ok' | 'error', error: string | null) => {
        if (settled) return;
        settled = true;
        socket.destroy();
        resolve({ status, error });
      };
      socket.setTimeout(this.dependencyTimeoutMs);
      socket.once('connect', () => finish('ok', null));
      socket.once('timeout', () => finish('error', 'timeout'));
      socket.once('error', (error) => finish('error', this.errorType(error)));
      socket.connect(this.mongoPort, this.mongoHost);
    });
  }

  private async checkOrion(): Promise<{ status: 'ok' | 'error'; error: string | null }> {
    try {
      await this.httpService.axiosRef.get(this.orionVersionUrl, {
        timeout: this.dependencyTimeoutMs,
      });
      return { status: 'ok', error: null };
    } catch (error) {
      return { status: 'error', error: this.errorType(error) };
    }
  }

  private numberConfig(key: string, fallback: number, minimum: number, maximum: number) {
    const raw = this.configService.get<string>(key);
    const value = raw === undefined ? fallback : Number(raw);
    if (!Number.isInteger(value) || value < minimum || value > maximum) {
      throw new Error(`${key} must be an integer between ${minimum} and ${maximum}`);
    }
    return value;
  }

  private iso(value: Date | string | null): string | null {
    return value ? new Date(value).toISOString() : null;
  }

  private errorType(error: any): string {
    return String(error?.code || error?.name || error?.message || 'unknown_error');
  }
}
