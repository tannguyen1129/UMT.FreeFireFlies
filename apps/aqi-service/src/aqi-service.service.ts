/*
 * Copyright 2025 Green-AQI Navigator Team
 *
 * Licensed under the Apache License, Version 2.0 (the "License");
 * you may not use this file except in compliance with the License.
 * You may obtain a copy of the License at
 *
 * http://www.apache.org/licenses/LICENSE-2.0
 *
 * Unless required by applicable law or agreed to in writing, software
 * distributed under the License is distributed on an "AS IS" BASIS,
 * WITHOUT WARRANTIES OR CONDITIONS OF ANY KIND, either express or implied.
 * See the License for the specific language governing permissions and
 * limitations under the License.
 */


import { Injectable, Logger, OnModuleInit, NotFoundException } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository } from 'typeorm';
import { HttpService } from '@nestjs/axios';
import { ConfigService } from '@nestjs/config';
import { Cron, CronExpression } from '@nestjs/schedule'; 
import { firstValueFrom } from 'rxjs';
import { Incident } from './entities/incident.entity';
import { CreateIncidentDto } from './dto/create-incident.dto';
import { AirQualityObservation } from './entities/air-quality-observation.entity';
import { WeatherObservation } from './entities/weather-observation.entity';
import { AQGridPoint } from './entities/aq-grid-point.entity';
import { UrbanGreenSpace } from './entities/urban-green-space.entity';
import { IncidentType } from './entities/incident-type.entity'; 
import { SensitiveArea } from './entities/sensitive-area.entity';
import { RoadFeature } from './entities/road-feature.entity';
import { ManageIncidentTypeDto } from './dto/manage-incident-type.dto';
import { UpdateIncidentStatusDto } from './dto/update-incident-status.dto';
import { PerceivedAirQuality } from './entities/perceived-air-quality.entity';
import { CreatePerceptionDto } from './dto/create-perception.dto';
import type { Polygon } from 'geojson'; 
import { MoreThan } from 'typeorm';

const HCMC_GRID = [
  { id: 'ThuDuc', lat: 10.8231, lon: 106.7711 }, // Q.Thủ Đức (cũ)
  { id: 'District12', lat: 10.8672, lon: 106.6415 }, // Q.12
  { id: 'HocMon', lat: 10.8763, lon: 106.5941 }, // H.Hóc Môn
  { id: 'District1', lat: 10.7769, lon: 106.7009 }, // Q.1 (Trung tâm)
  { id: 'BinhTan', lat: 10.7656, lon: 106.6031 }, // Q.Bình Tân
  { id: 'District2', lat: 10.7877, lon: 106.7407 }, // Q.2 (cũ)
  { id: 'District7', lat: 10.734, lon: 106.7206 }, // Q.7
  { id: 'BinhChanh', lat: 10.718, lon: 106.6067 }, // H.Bình Chánh
  { id: 'CanGio', lat: 10.518, lon: 106.8776 }, // H.Cần Giờ
];

const sleep = (ms: number) => new Promise((r) => setTimeout(r, ms));

@Injectable()
export class AqiServiceService implements OnModuleInit {
  private readonly logger = new Logger(AqiServiceService.name);
  private readonly ORION_LD_URL: string;
  private readonly OWM_API_KEY: string; 
  private readonly owmApiUrl = 'http://api.openweathermap.org/data/2.5/air_pollution';
  private readonly overpassApiUrl = 'https://overpass-api.de/api/interpreter';
  private readonly owmWeatherApiUrl = 'http://api.openweathermap.org/data/2.5/weather';
  
  

  private readonly NGSI_LD_CONTEXT = [
      'https://smartdatamodels.org/context.jsonld',
      'https://uri.etsi.org/ngsi-ld/v1/ngsi-ld-core-context-v1.7.jsonld'
  ];

  constructor(
    @InjectRepository(Incident)
    private readonly incidentRepository: Repository<Incident>,
    @InjectRepository(IncidentType) 
    private readonly incidentTypeRepository: Repository<IncidentType>,
    @InjectRepository(AirQualityObservation)
    private readonly observationRepository: Repository<AirQualityObservation>,
    @InjectRepository(WeatherObservation) 
    private readonly weatherRepository: Repository<WeatherObservation>,
    @InjectRepository(AQGridPoint)
    private readonly gridPointRepository: Repository<AQGridPoint>,
    @InjectRepository(UrbanGreenSpace)
    private readonly greenSpaceRepository: Repository<UrbanGreenSpace>,
    @InjectRepository(SensitiveArea)
    private readonly sensitiveAreaRepository: Repository<SensitiveArea>,
    @InjectRepository(RoadFeature) 
    private readonly roadFeatureRepository: Repository<RoadFeature>,
    @InjectRepository(PerceivedAirQuality) 
    private readonly perceptionRepository: Repository<PerceivedAirQuality>,

    private readonly httpService: HttpService,
    private readonly configService: ConfigService,
  ) {
    const orionUrl = this.configService.get<string>('ORION_LD_URL');
    if (!orionUrl) throw new Error('ORION_LD_URL is not defined in .env file');
    this.ORION_LD_URL = orionUrl;

    const owmKey = this.configService.get<string>('OWM_API_KEY');
    if (!owmKey) throw new Error('OWM_API_KEY is not defined in .env file');
    this.OWM_API_KEY = owmKey;
  }

  async onModuleInit() {
    this.logger.log('AqiServiceModule initialized.');

    // 1. Agent OWM & Weather
    this.logger.log('Triggering initial OWM & Weather data ingestion...');
    try {
      await this.handleOwmDataIngestion();
      await this.handleWeatherDataIngestion();
    } catch (err) { }
    
    // 2. Agent Green Space
    this.logger.log('Triggering initial Green Space ingestion...');
    try {
      await this.handleGreenSpaceIngestion();
    } catch (err) { }

    // 3. 🚀 KÍCH HOẠT NGAY AGENT SENSITIVE AREA (ĐỂ TEST)
    this.logger.log('Triggering initial Sensitive Area ingestion (School, Hospital...)...');
    try {
      // Gọi hàm này ngay lập tức thay vì đợi đến 4h sáng
      await this.handleSensitiveAreaIngestion(); 
    } catch (err) {
      this.logger.error('Initial Sensitive Area ingestion failed', err.message);
    }

    this.logger.log('Triggering initial Road Feature ingestion...');
    try {
        // Gọi hàm này nhưng KHÔNG await để nó chạy nền, không chặn app khởi động
        // Tuy nhiên, để test lần đầu, bạn có thể await nếu muốn xem log ngay
        this.handleRoadFeatureIngestion(); 
    } catch (err) { }

  }


  @Cron('*/5 * * * *')  
  async handleOwmDataIngestion() {
    this.logger.log(`Running Data Ingestion Agent for OWM (Grid: ${HCMC_GRID.length} points)...`);
    
    let savedCount = 0;

    for (const gridPoint of HCMC_GRID) {
      try {
        const response = await firstValueFrom(
          this.httpService.get(this.owmApiUrl, {
            headers: { 'Accept': 'application/json' },
            params: { 
              lat: gridPoint.lat, // 👈 Dùng tọa độ của Lưới
              lon: gridPoint.lon, 
              appid: this.OWM_API_KEY 
            },
            timeout: 10000, 
          }),
        );

        const list = response.data?.list || [];
        if (list.length === 0) {
          this.logger.warn(`⚠️ OWM returned no data for grid point: ${gridPoint.id}`);
          continue; // Bỏ qua điểm này, tiếp tục điểm khác
        }
        
        const owmData = list[0]; 

        const researchGridPoint = await this.getOrCreateGridPoint(gridPoint);
        const observationEntity = this.formatOwmToAqiEntity(owmData, researchGridPoint);
        
        if (observationEntity) {
          await this.upsertAirQualityObservation(observationEntity);
          const ngsiLdPayload = this.formatObservationToNgsiLd(observationEntity);
          await this.syncToOrionLD(ngsiLdPayload); 
          savedCount++;
        }
        
      } catch (error) {
        if (error.code === 'ECONNABORTED') {
           this.logger.error(`❌ Failed to ingest OWM data for ${gridPoint.id}: Request timed out`);
        } else {
            this.logger.error(`❌ Failed to ingest OWM data for ${gridPoint.id}`, error?.response?.data || error?.message || error);
        }
      }
    } // Hết vòng lặp

    this.logger.log(`✅ Successfully ingested and synced ${savedCount} OWM grid point(s).`);
  }


  @Cron(CronExpression.EVERY_DAY_AT_3AM) 
  async handleGreenSpaceIngestion() {
    this.logger.log('Running Data Ingestion Agent for OpenStreetMap (Overpass)...');
    
    const bbox = '10.35,106.24,11.18,107.02'; 
    const overpassQuery = `
      [out:json][timeout:60];
      (
        way["leisure"="park"](${bbox});
      );
      out geom;
    `;
    
    try {
      const response = await firstValueFrom(
        this.httpService.post(this.overpassApiUrl, overpassQuery, {
          headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
          timeout: 60000,
        }),
      );

      const elements = response.data?.elements || [];
      if (elements.length === 0) {
        this.logger.warn('⚠️ Overpass API returned no parks (leisure=park) for HCMC.');
        return;
      }

      let savedCount = 0;
      for (const element of elements) {
        if (element.type !== 'way' || !element.geometry) continue; 
        
        const entity = this.formatOverpassToEntity(element);
        if (!entity) continue;

        await this.greenSpaceRepository.save(entity);
        
        const ngsiLdPayload = this.formatGreenSpaceToNgsiLd(entity);
        await this.syncToOrionLD(ngsiLdPayload);
        savedCount++;
      }
      this.logger.log(`✅ Successfully ingested and synced ${savedCount} green space(s).`);

    } catch (error) {
      if (error.code === 'ECONNABORTED') {
         this.logger.error('❌ Failed to ingest OpenStreetMap data: Request timed out (60s)');
      } else {
         this.logger.error('❌ Failed to ingest OpenStreetMap data', error.response?.data || error.message);
      }
    }
  }

  @Cron('*/5 * * * *')
  async handleWeatherDataIngestion() {
    this.logger.log(`Running Data Ingestion Agent for OWM (Weather Grid: ${HCMC_GRID.length} points)...`);
    
    let savedCount = 0;
    for (const gridPoint of HCMC_GRID) {
      try {
        const response = await firstValueFrom(
          this.httpService.get(this.owmWeatherApiUrl, { 
            headers: { 'Accept': 'application/json' },
            params: { 
              lat: gridPoint.lat,
              lon: gridPoint.lon, 
              appid: this.OWM_API_KEY,
              units: 'metric' 
            },
            timeout: 10000, 
          }),
        );

        const weatherData = response.data;
        if (!weatherData || !weatherData.main) {
          this.logger.warn(`⚠️ OWM returned no weather data for grid point: ${gridPoint.id}`);
          continue;
        }
        
        const researchGridPoint = await this.getOrCreateGridPoint(gridPoint);
        const observationEntity = this.formatOwmToWeatherEntity(weatherData, researchGridPoint);
        
        if (observationEntity) {
          await this.upsertWeatherObservation(observationEntity);
          const ngsiLdPayload = this.formatWeatherToNgsiLd(observationEntity);
          await this.syncToOrionLD(ngsiLdPayload); 
          savedCount++;
        }
        
      } catch (error) {
        if (error.code === 'ECONNABORTED') {
           this.logger.error(`❌ Failed to ingest Weather data for ${gridPoint.id}: Request timed out`);
        } else {
            this.logger.error(`❌ Failed to ingest Weather data for ${gridPoint.id}`, error?.response?.data || error?.message || error);
        }
      }
    }
    this.logger.log(`✅ Successfully ingested and synced ${savedCount} OWM Weather grid point(s).`);
  }

  private async retryOperation<T>(operation: () => Promise<T>, retries = 3, delay = 5000): Promise<T> {
    try {
      return await operation();
    } catch (error) {
      if (retries > 0) {
        this.logger.warn(`⚠️ Operation failed, retrying in ${delay}ms... (${retries} left)`);
        await sleep(delay);
        return this.retryOperation(operation, retries - 1, delay * 2); // Tăng thời gian chờ (Exponential Backoff)
      } else {
        throw error;
      }
    }
  }


  @Cron(CronExpression.EVERY_DAY_AT_4AM) 
  async handleSensitiveAreaIngestion() {
    this.logger.log('Running Agent for Sensitive Areas (Optimized)...');
    const bbox = '10.35,106.24,11.18,107.02'; 
    const overpassQuery = `[out:json][timeout:180];(way["amenity"~"school|hospital|police"](${bbox});way["landuse"="military"](${bbox}););out geom;`;
    
    try {
      // Dùng retry cho call lớn này
      const response = await this.retryOperation(() => 
        firstValueFrom(
          this.httpService.post(this.overpassApiUrl, overpassQuery, {
            headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
            timeout: 180000, 
          })
        ), 3, 10000 // Thử lại 3 lần, chờ 10s
      );

      const elements = response.data?.elements || [];
      let savedCount = 0;
      for (const element of elements) {
        if (element.type !== 'way' || !element.geometry) continue; 
        const entity = this.formatOverpassToSensitiveArea(element);
        if (!entity) continue;
        await this.sensitiveAreaRepository.save(entity);
        const ngsiLdPayload = this.formatSensitiveAreaToNgsiLd(entity);
        await this.syncToOrionLD(ngsiLdPayload);
        savedCount++;
      }
      this.logger.log(`✅ Successfully ingested and synced ${savedCount} sensitive area(s).`);
    } catch (error) {
       this.logger.error('❌ Failed to ingest Sensitive Areas (After retries)', error.message);
    }
  }


  @Cron(CronExpression.EVERY_WEEK)
  async handleRoadFeatureIngestion() {
    this.logger.log(`Running Agent for Road Features (Optimized)...`);
    
    let savedCount = 0;
    
    for (const gridPoint of HCMC_GRID) {
        const stationId = `urn:ngsi-ld:AirQualityStation:OWM-${gridPoint.id}`;
        const overpassQuery = `[out:json][timeout:90];(way(around:500, ${gridPoint.lat}, ${gridPoint.lon})["highway"~"primary|secondary"];);out count;`;

        try {
            // Dùng retry cho từng điểm
            const response = await this.retryOperation(() => 
                firstValueFrom(
                    this.httpService.post(this.overpassApiUrl, overpassQuery, {
                        headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
                        timeout: 60000, 
                    })
                ), 2, 5000 // Thử lại 2 lần, chờ 5s
            );
            
            const count = response.data?.elements?.[0]?.tags?.total || 0; 
            await this.roadFeatureRepository.upsert({ entity_id: stationId, majorRoadCount: parseInt(count, 10) }, ['entity_id']);
            savedCount++;
            this.logger.log(`[RoadFeature] ${gridPoint.id}: ${count} major roads.`);

        } catch (error) {
            this.logger.error(`❌ Failed ${gridPoint.id} (Final): ${error.message}`);
        }

        await sleep(10000); 
    }
    
    this.logger.log(`✅ Successfully ingested and synced ${savedCount} Road Features.`);
  }

  async createPerception(dto: CreatePerceptionDto, userId: string) {
    this.logger.log(`User ${userId} báo cáo cảm nhận: Mức ${dto.feeling}`);

    // 1. Lưu vào PostgreSQL
    const perception = this.perceptionRepository.create({
      userId: userId,
      feeling: dto.feeling,
      location: {
        type: 'Point',
        coordinates: [dto.longitude, dto.latitude],
      },
    });
    const saved = await this.perceptionRepository.save(perception);

    // 2. Đồng bộ lên Orion-LD (Chạy nền)
    const ngsiLdPayload = {
      id: `urn:ngsi-ld:PerceivedAirQuality:${saved.id}`,
      type: 'PerceivedAirQuality',
      dateObserved: {
        type: 'Property',
        value: { '@type': 'DateTime', '@value': saved.createdAt.toISOString() }
      },
      location: { type: 'GeoProperty', value: saved.location },
      feeling: { type: 'Property', value: saved.feeling },
      reportedBy: { type: 'Relationship', object: `urn:ngsi-ld:User:${userId}` },
      '@context': this.NGSI_LD_CONTEXT
    };

    this.syncToOrionLD(ngsiLdPayload).catch(e => 
      this.logger.error('Lỗi sync PerceivedAirQuality', e.message)
    );

    return saved;
  }

  private formatOverpassToSensitiveArea(element: any): SensitiveArea | null {
    const geom: Polygon = {
      type: 'Polygon',
      coordinates: [ element.geometry.map((point: any) => [point.lon, point.lat]) ],
    };
    // Đóng polygon
    const first = geom.coordinates[0][0];
    const last = geom.coordinates[0][geom.coordinates[0].length - 1];
    if (first[0] !== last[0] || first[1] !== last[1]) geom.coordinates[0].push(first);

    const entity = new SensitiveArea();
    entity.entity_id = `osm-${element.type}-${element.id}`;
    entity.name = element.tags?.name || 'Không rõ tên';
    
    // Xác định loại (Category)
    if (element.tags?.amenity === 'school') entity.category = 'school';
    else if (element.tags?.amenity === 'hospital') entity.category = 'hospital';
    else if (element.tags?.amenity === 'police') entity.category = 'police';
    else if (element.tags?.landuse === 'military') entity.category = 'military';
    else entity.category = 'other';

    entity.geom = geom;
    return entity;
  }
  
  private formatOwmToAqiEntity(
    owmData: any,
    gridPoint: AQGridPoint,
  ): AirQualityObservation | null {
    
    if (!owmData || !owmData.components || !owmData.dt) {
      this.logger.warn(`Invalid OWM data received for ${gridPoint.code}, skipping.`);
      return null;
    }
    const obs = new AirQualityObservation();

    obs.gridPoint = gridPoint;
    obs.gridPointId = gridPoint.id;
    obs.source = 'openweathermap';
    obs.sourceObservedAt = new Date(owmData.dt * 1000);

    // Map các thành phần
    obs.pm2_5 = owmData.components.pm2_5 ?? null;
    obs.pm10 = owmData.components.pm10 ?? null;
    obs.co = owmData.components.co ?? null;
    obs.no = owmData.components.no ?? null;
    obs.no2 = owmData.components.no2 ?? null;
    obs.so2 = owmData.components.so2 ?? null;
    obs.o3 = owmData.components.o3 ?? null;
    obs.nh3 = owmData.components.nh3 ?? null;
    obs.aqi = owmData.main?.aqi ?? null;
    obs.rawPayload = owmData;
    return obs;
  }
  
  private formatOverpassToEntity(element: any): UrbanGreenSpace | null {
    const geom: Polygon = {
      type: 'Polygon',
      coordinates: [
        element.geometry.map((point: any) => [point.lon, point.lat])
      ],
    };

    const firstPoint = geom.coordinates[0][0];
    const lastPoint = geom.coordinates[0][geom.coordinates[0].length - 1];
    if (firstPoint[0] !== lastPoint[0] || firstPoint[1] !== lastPoint[1]) {
      geom.coordinates[0].push(firstPoint);
    }

    const entity = new UrbanGreenSpace();
    entity.entity_id = `osm-${element.type}-${element.id}`;
    entity.name = element.tags?.name;
    entity.category = element.tags?.leisure || element.tags?.landuse || element.tags?.natural;
    entity.geom = geom;

    return entity;
  }

  private formatOwmToWeatherEntity(
    weatherData: any,
    gridPoint: AQGridPoint,
  ): WeatherObservation | null {
    if (!weatherData?.dt) {
      this.logger.warn(`Invalid OWM weather data received for ${gridPoint.code}, skipping.`);
      return null;
    }

    const obs = new WeatherObservation();
    obs.gridPoint = gridPoint;
    obs.gridPointId = gridPoint.id;
    obs.source = 'openweathermap';
    obs.sourceObservedAt = new Date(weatherData.dt * 1000);
    obs.temperature = weatherData.main?.temp ?? null;
    obs.humidity = weatherData.main?.humidity ?? null;
    obs.pressure = weatherData.main?.pressure ?? null;
    obs.windSpeed = weatherData.wind?.speed ?? null;
    obs.windDirection = weatherData.wind?.deg ?? null;
    obs.clouds = weatherData.clouds?.all ?? null;
    obs.rain = weatherData.rain?.['1h'] ?? weatherData.rain?.['3h'] ?? null;
    obs.rawPayload = weatherData;
    
    return obs;
  }

  private async getOrCreateGridPoint(gridPoint: {
    id: string;
    lat: number;
    lon: number;
  }): Promise<AQGridPoint> {
    const code = `HCMC-OLP-${gridPoint.id}`;
    await this.gridPointRepository.upsert(
      {
        code,
        name: gridPoint.id,
        latitude: gridPoint.lat,
        longitude: gridPoint.lon,
        source: 'openweathermap',
        gridVersion: 'hcmc-olp-v0',
        active: true,
      },
      ['code'],
    );

    return this.gridPointRepository.findOneByOrFail({ code });
  }

  private async upsertAirQualityObservation(
    observation: AirQualityObservation,
  ): Promise<void> {
    await this.observationRepository.upsert(
      {
        gridPointId: observation.gridPointId,
        source: observation.source,
        sourceObservedAt: observation.sourceObservedAt,
        aqi: observation.aqi,
        pm2_5: observation.pm2_5,
        pm10: observation.pm10,
        co: observation.co,
        no: observation.no,
        no2: observation.no2,
        o3: observation.o3,
        so2: observation.so2,
        nh3: observation.nh3,
        rawPayload: observation.rawPayload,
      },
      ['source', 'gridPointId', 'sourceObservedAt'],
    );
  }

  private async upsertWeatherObservation(
    observation: WeatherObservation,
  ): Promise<void> {
    await this.weatherRepository.upsert(
      {
        gridPointId: observation.gridPointId,
        source: observation.source,
        sourceObservedAt: observation.sourceObservedAt,
        temperature: observation.temperature,
        humidity: observation.humidity,
        pressure: observation.pressure,
        windSpeed: observation.windSpeed,
        windDirection: observation.windDirection,
        clouds: observation.clouds,
        rain: observation.rain,
        rawPayload: observation.rawPayload,
      },
      ['source', 'gridPointId', 'sourceObservedAt'],
    );
  }

  private formatSensitiveAreaToNgsiLd(entity: SensitiveArea): any {
    return {
      id: `urn:ngsi-ld:SensitiveArea:${entity.entity_id}`, 
      type: 'SensitiveArea', 
      name: { type: 'Property', value: entity.name },
      category: { type: 'Property', value: entity.category },
      location: { type: 'GeoProperty', value: entity.geom },
      '@context': this.NGSI_LD_CONTEXT,
    };
  }

  // HELPER MỚI: Format Dữ liệu Thời tiết (sang NGSI-LD)
  private formatWeatherToNgsiLd(obs: WeatherObservation): any {
    const payload = {
      id: `urn:ngsi-ld:WeatherObservation:OWM-${obs.gridPoint.code}`,
      type: 'WeatherObserved', 
      location: { type: 'GeoProperty', value: {
        type: 'Point',
        coordinates: [obs.gridPoint.longitude, obs.gridPoint.latitude],
      } },
      dateObserved: { type: 'Property', value: { '@type': 'DateTime', '@value': obs.sourceObservedAt.toISOString() } },
      temperature: { type: 'Property', value: obs.temperature, unitCode: 'CEL' }, 
      relativeHumidity: { type: 'Property', value: obs.humidity === null ? null : obs.humidity / 100 },
      windSpeed: { type: 'Property', value: obs.windSpeed, unitCode: 'MTS' }, 
      windDirection: { type: 'Property', value: obs.windDirection }, 
      '@context': this.NGSI_LD_CONTEXT,
    };
    return payload;
  }

  // 🚀 SỬA LỖI: Thêm @context nội tuyến
  private formatGreenSpaceToNgsiLd(entity: UrbanGreenSpace): any {
    const entityId = `urn:ngsi-ld:UrbanGreenSpace:${entity.entity_id}`;
    return {
      id: entityId, 
      type: 'UrbanGreenSpace',
      name: { type: 'Property', value: entity.name || 'Không rõ tên' },
      category: { type: 'Property', value: entity.category },
      location: { type: 'GeoProperty', value: entity.geom },
      '@context': this.NGSI_LD_CONTEXT, 
    };
  }

  private formatObservationToNgsiLd(obs: AirQualityObservation): any {
    const payload = {
      id: `urn:ngsi-ld:AirQualityObservation:OWM-${obs.gridPoint.code}`,
      type: 'AirQualityObserved',
      location: { type: 'GeoProperty', value: {
        type: 'Point',
        coordinates: [obs.gridPoint.longitude, obs.gridPoint.latitude],
      } },
      dateObserved: { type: 'Property', value: { '@type': 'DateTime', '@value': obs.sourceObservedAt.toISOString() } },
      aqi: { type: 'Property', value: obs.aqi },
      pm25: { type: 'Property', value: obs.pm2_5, unitCode: 'µg/m³' },
      pm10: { type: 'Property', value: obs.pm10, unitCode: 'µg/m³' },
      no2: { type: 'Property', value: obs.no2, unitCode: 'µg/m³' },
      so2: { type: 'Property', value: obs.so2, unitCode: 'µg/m³' },
      o3: { type: 'Property', value: obs.o3, unitCode: 'µg/m³' },
      '@context': this.NGSI_LD_CONTEXT, 
    };
    // Xóa thuộc tính rỗng
    Object.keys(payload).forEach(key => {
      const prop = payload[key];
      if (key !== 'id' && key !== 'type' && key !== '@context' && prop && (prop.value === undefined || prop.value === null)) {
        delete payload[key];
      }
    });
    return payload;
  }

  private async syncToOrionLD(payload: any, entityId?: string) {
    const idToSync = entityId || payload.id;
    if (!idToSync) {
      this.logger.error('Sync to Orion-LD failed: No entity ID provided.');
      return;
    }


    // (Giống như từ updateIncidentStatus)
    if (entityId) {
      try {
        const patchPayload = { ...payload };
        delete patchPayload.id; // Xóa id/type (nếu có)
        delete patchPayload.type;
        if (!patchPayload['@context']) { // Đảm bảo @context
          patchPayload['@context'] = this.NGSI_LD_CONTEXT;
        }
        
        const entityUrl = `${this.ORION_LD_URL}/${encodeURIComponent(idToSync)}/attrs`;
        
        await firstValueFrom(
          this.httpService.patch(entityUrl, patchPayload, { 
            headers: { 'Content-Type': 'application/ld+json' },
          }),
        );
      } catch (patchErr) {
        this.logger.error(`Failed to PATCH existing entity ${idToSync}`, patchErr?.response?.data || patchErr?.message || patchErr);
        throw patchErr; // Ném lỗi
      }
      return; // Kết thúc
    }

    // (Giống như từ createIncident, handleOwm, handleGreenSpace)
    try {
      const postPayload = { ...payload };
      if (!postPayload['@context']) {
          postPayload['@context'] = this.NGSI_LD_CONTEXT;
      }

      await firstValueFrom(
        this.httpService.post(this.ORION_LD_URL, postPayload, { 
          headers: { 'Content-Type': 'application/ld+json' }, 
        }),
      );
    } catch (error) {
      // Nếu POST thất bại (đã tồn tại), thử PATCH
      const status = error.response?.status;
      if (status === 409 || status === 422) { 
        this.logger.warn(`Entity ${idToSync} already exists, attempting PATCH...`);
        // Gọi lại chính hàm này, nhưng với entityId để ép nó vào TRƯỜNG HỢP 1
        await this.syncToOrionLD(payload, idToSync);
      } else {
        this.logger.error(`Failed to POST to Orion-LD (ID: ${idToSync})`, error?.response?.data || error?.message || error);
        throw error; 
      }
    }
  }


  async findAllForecasts(): Promise<any> {
    this.logger.log('--- (Tầng 2) Yêu cầu lấy danh sách Dự báo (Forecasts)...');
    
    const params = {
      type: 'AirQualityForecast', 
      limit: 100 
    };
    
    try {
      const response = await firstValueFrom(
        this.httpService.get(this.ORION_LD_URL, { 
          params: params,
          headers: {
            'Accept': 'application/ld+json',

          },
          timeout: 5000,
        }),
      );
      return response.data; 
    } catch (error) {
      this.logger.error('Error fetching forecasts from Orion-LD', error.response?.data);
      throw new Error('Failed to fetch forecasts from Orion-LD');
    }
  }

  
  async createIncident(dto: CreateIncidentDto, userId: string): Promise<Incident> {
    this.logger.log(`--- (Tầng 2) BƯỚC 1: Nhận được request tạo Incident từ user: ${userId}`);
    
    const newIncidentEntity = this.incidentRepository.create({
      ...dto,
      reported_by_user_id: userId,
      status: 'pending',
    });

    try {
      this.logger.log('--- (Tầng 2) BƯỚC 2: Đang lưu vào PostgreSQL...');
      const savedIncident = await this.incidentRepository.save(newIncidentEntity);
      this.logger.log(`--- (Tầng 2) BƯỚC 2: Đã lưu vào DB (ID: ${savedIncident.incident_id})`);

      const ngsiLdPayload = this.formatIncidentToNgsiLd(savedIncident);
      
      this.logger.log('--- (Tầng 2) BƯỚC 3: Đang đồng bộ lên Orion-LD (Async)...');
      
      // (Không await - fix lỗi timeout)
      this.syncToOrionLD(ngsiLdPayload)
        .then(() => {
          this.logger.log(`--- (Tầng 2) BƯỚC 3: Đồng bộ Orion-LD (Async) THÀNH CÔNG (ID: ${savedIncident.incident_id})`);
        })
        .catch((err) => {
          this.logger.error(`--- (Tầng 2) BƯỚC 3: Đồng bộ Orion-LD (Async) THẤT BẠI (ID: ${savedIncident.incident_id})`);
        });

      return savedIncident; 
      
    } catch (error) {
      this.logger.error('--- (Tầng 2) LỖI NGHIÊM TRỌNG TRONG createIncident (Lỗi CSDL) ---');
      this.logger.error(error.message, error.stack);
      throw error; 
    }
  }
  
  async findAllIncidents(): Promise<Incident[]> {
    return this.incidentRepository.find({
      relations: ['incidentType'], 
      order: { created_at: 'DESC' },
    });
  }

  async findAllIncidentTypes(): Promise<IncidentType[]> {
    this.logger.log('--- (Tầng 2) Yêu cầu lấy danh sách Loại Sự cố...');
    return this.incidentTypeRepository.find();
  }


  async createIncidentType(dto: ManageIncidentTypeDto): Promise<IncidentType> {
    this.logger.log(`--- (Tầng 2) Admin tạo Loại Sự cố mới: ${dto.type_name}`);
    const newType = this.incidentTypeRepository.create(dto);
    return this.incidentTypeRepository.save(newType);
  }


  async updateIncidentType(id: number, dto: ManageIncidentTypeDto): Promise<IncidentType> {
    this.logger.log(`--- (Tầng 2) Admin cập nhật Loại Sự cố ID: ${id}`);
    const type = await this.incidentTypeRepository.findOneBy({ type_id: id });
    if (!type) {
      throw new NotFoundException(`Không tìm thấy loại sự cố với ID: ${id}`);
    }
    
    // Cập nhật các trường
    type.type_name = dto.type_name;
    

    type.description = dto.description ?? ''; 
    
    return this.incidentTypeRepository.save(type);
  }

  async deleteIncidentType(id: number): Promise<void> {
    this.logger.log(`--- (Tầng 2) Admin xóa Loại Sự cố ID: ${id}`);
    // TODO: Nên kiểm tra xem có incident nào đang dùng type này không trước khi xóa
    const result = await this.incidentTypeRepository.delete(id);
    if (result.affected === 0) {
      throw new NotFoundException(`Không tìm thấy loại sự cố với ID: ${id}`);
    }
  }


  async findMyIncidents(userId: string): Promise<Incident[]> {
    this.logger.log(`--- (Tầng 2) User ${userId} yêu cầu lấy báo cáo CỦA TÔI...`);
    return this.incidentRepository.find({
      where: {
        reported_by_user_id: userId, 
      },
      relations: ['incidentType'], // Lấy luôn tên loại sự cố
      order: { created_at: 'DESC' }, // Sắp xếp mới nhất lên đầu
    });
  }

  async updateIncidentStatus(incidentId: string, dto: UpdateIncidentStatusDto): Promise<Incident> {
    this.logger.log(`--- (Tầng 2) Đang cập nhật trạng thái Incident ID: ${incidentId} -> ${dto.status}`);

    // 1. Lấy thông tin Incident (để biết ai là người báo cáo)
    const incident = await this.incidentRepository.findOne({
        where: { incident_id: incidentId },
        relations: ['incidentType'] // Load thêm thông tin để hiển thị nếu cần
    });

    if (!incident) {
      throw new NotFoundException(`Không tìm thấy sự cố với ID: ${incidentId}`);
    }

    // 2. Cập nhật CSDL
    incident.status = dto.status;
    await this.incidentRepository.save(incident);
    
    // 3. Cập nhật Orion-LD (Giữ nguyên code cũ)
    const entityId = `urn:ngsi-ld:Incident:${incidentId}`;
    const patchPayload = { status: { type: 'Property', value: dto.status }, '@context': this.NGSI_LD_CONTEXT };
    this.syncToOrionLD(patchPayload, entityId).catch(e => this.logger.error('Sync Error', e));

    // Gọi bất đồng bộ (không await) để không chặn UI của Admin
    this.notifyUserAboutIncident(incident.reported_by_user_id, incident.status, incident.description);
    
    return incident;
  }

  private async notifyUserAboutIncident(userId: string, status: string, description: string) {
      try {
          // Gọi sang Notification Service chạy ở cổng 3004
          await firstValueFrom(
              this.httpService.post('http://localhost:3004/api/notify-incident', {
                  userId,
                  status,
                  description
              })
          );
          this.logger.log(`📞 Đã gọi Notification Service cho User ${userId}`);
      } catch (e) {
          this.logger.error(`❌ Không gọi được Notification Service: ${e.message}`);
      }
  }

  private formatIncidentToNgsiLd(incident: Incident): any {
    const entityId = `urn:ngsi-ld:Incident:${incident.incident_id}`;
    return {
      id: entityId,
      type: 'Incident',
      location: { type: 'GeoProperty', value: incident.location },
      incidentType: {
        type: 'Property',
        value: `urn:ngsi-ld:IncidentType:${incident.incident_type_id}`, 
      },
      description: { type: 'Property', value: incident.description || '' },
      status: { type: 'Property', value: incident.status },
      dateReported: {
        type: 'Property',
        value: { '@type': 'DateTime', '@value': incident.created_at.toISOString() },
      },
      reportedBy: {
        type: 'Relationship',
        object: `urn:ngsi-ld:User:${incident.reported_by_user_id}`,
      },
      '@context': this.NGSI_LD_CONTEXT, 
    };
  }

  async getAnalyticsData() {
    this.logger.log('--- (Tầng 2) Đang tổng hợp dữ liệu Analytics...');

    // 1. XU HƯỚNG AQI (24 Giờ qua)
    const trendData = await this.observationRepository
      .createQueryBuilder('obs')
      .select("DATE_TRUNC('hour', obs.source_observed_at)", 'hour')
      .addSelect('AVG(obs.pm2_5)', 'avg_pm25')
      .where("obs.source_observed_at > NOW() - INTERVAL '24 hours'")
      .groupBy('hour')
      .orderBy('hour', 'ASC')
      .getRawMany();

    // 2. THỐNG KÊ SỰ CỐ (Theo trạng thái)
    // SQL: SELECT status, COUNT(*) FROM incidents GROUP BY status
    const incidentStats = await this.incidentRepository
      .createQueryBuilder('inc')
      .select('inc.status', 'status')
      .addSelect('COUNT(*)', 'count') // Đếm tất cả
      .groupBy('inc.status')
      .getRawMany();

    // 3. TƯƠNG QUAN: GIAO THÔNG vs Ô NHIỄM (Theo Trạm)
    // Bước 3a: Lấy PM2.5 trung bình hiện tại của từng trạm
    const stationStats = await this.observationRepository
      .createQueryBuilder('obs')
      .innerJoin('obs.gridPoint', 'grid')
      .select('grid.code', 'grid_code')
      .addSelect('AVG(obs.pm2_5)', 'avg_pm25')
      .where("obs.source_observed_at > NOW() - INTERVAL '1 hour'") // Lấy trung bình 1 giờ qua
      .groupBy('grid.code')
      .getRawMany();
    
      // LOG RA ĐỂ DEBUG
    this.logger.log(`📊 Incident Stats Raw: ${JSON.stringify(incidentStats)}`);

    // Chuyển đổi count từ string sang number (QUAN TRỌNG)
    const formattedIncidents = incidentStats.map(item => ({
        status: item.status,
        count: parseInt(item.count, 10) || 0
    }));

    // Bước 3b: Lấy dữ liệu Road Feature (Số lượng đường)
    const roadFeatures = await this.roadFeatureRepository.find();

    // Bước 3c: Gộp lại (Join trong code)
    const correlationData = stationStats.map((stat) => {
      const legacyGridId = stat.grid_code.replace('HCMC-OLP-', '');
      const roadData = roadFeatures.find((r) => r.entity_id.endsWith(`OWM-${legacyGridId}`));
      
      return {
        district: legacyGridId,
        pm25: parseFloat(stat.avg_pm25), // Ép kiểu về số
        roadCount: roadData ? roadData.majorRoadCount : 0,
      };
    });

    // Trả về object tổng hợp
    return {
      trend: trendData,       // Dữ liệu cho Biểu đồ Đường
      incidents: formattedIncidents, // Dữ liệu cho Biểu đồ Tròn
      correlation: correlationData // Dữ liệu cho Biểu đồ Phân tán/Cột
    };
  }

  async findAllPerceptions() {
    return this.perceptionRepository.find({
      order: { createdAt: 'DESC' }, // Lấy mới nhất
      take: 100, // Giới hạn 100 điểm để không lag bản đồ
    });
  }

}
