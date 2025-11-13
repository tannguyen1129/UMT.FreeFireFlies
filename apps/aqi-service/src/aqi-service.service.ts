import { Injectable, Logger, OnModuleInit } from '@nestjs/common';
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
import { UrbanGreenSpace } from './entities/urban-green-space.entity';
import type { Polygon } from 'geojson'; 

@Injectable()
export class AqiServiceService implements OnModuleInit {
  private readonly logger = new Logger(AqiServiceService.name);
  private readonly ORION_LD_URL: string;
  private readonly OWM_API_KEY: string; 
  private readonly owmApiUrl = 'http://api.openweathermap.org/data/2.5/air_pollution';
  private readonly overpassApiUrl = 'https://overpass-api.de/api/interpreter';
  
  private readonly HCMC_LAT = 10.7769;
  private readonly HCMC_LON = 106.7009;
  private readonly HCMC_VIRTUAL_STATION_ID = 'urn:ngsi-ld:AirQualityStation:HCMC-Central-OWM';

  constructor(
    @InjectRepository(Incident)
    private readonly incidentRepository: Repository<Incident>,
    @InjectRepository(AirQualityObservation)
    private readonly observationRepository: Repository<AirQualityObservation>,
    @InjectRepository(WeatherObservation) 
    private readonly weatherRepository: Repository<WeatherObservation>,
    @InjectRepository(UrbanGreenSpace)
    private readonly greenSpaceRepository: Repository<UrbanGreenSpace>,

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
    this.logger.log('Triggering initial OWM data ingestion...');
    try {
      await this.handleOwmDataIngestion();
    } catch (err) {
      // Đã bắt lỗi bên trong
    }
    
    this.logger.log('Triggering initial Green Space ingestion...');
    try {
      await this.handleGreenSpaceIngestion();
    } catch (err) {
      this.logger.error('Initial Green Space ingestion failed', err?.response?.data || err?.message || err);
    }
  }

  // ================================================================
  // 🔁 AGENT 1: THU THẬP DỮ LIỆU OWM (Giữ nguyên)
  // ================================================================
  @Cron('*/15 * * * *')
  async handleOwmDataIngestion() {
    this.logger.log('Running Data Ingestion Agent for OpenWeatherMap (OWM)...');
    try {
      const response = await firstValueFrom(
        this.httpService.get(this.owmApiUrl, {
          headers: { 'Accept': 'application/json' },
          params: { lat: this.HCMC_LAT, lon: this.HCMC_LON, appid: this.OWM_API_KEY },
        }),
      );
      const list = response.data?.list || [];
      if (list.length === 0) {
        this.logger.warn('⚠️ OWM returned no air pollution data for HCMC.');
        return;
      }
      const owmData = list[0]; 
      const observationEntity = this.formatOwmToAqiEntity(owmData);
      if (observationEntity) {
        await this.observationRepository.save(observationEntity);
        const ngsiLdPayload = this.formatObservationToNgsiLd(observationEntity);
        await this.syncToOrionLD(ngsiLdPayload); 
      }
      this.logger.log(`✅ Successfully ingested and synced OWM data for HCMC.`);
    } catch (error) {
      if (!error.response?.data?.title?.includes('Entity id is missing')) {
          this.logger.error('❌ Failed to ingest OWM data', error?.response?.data || error?.message || error);
      }
    }
  }

  // ================================================================
  // 🌳 AGENT 2: THU THẬP KHÔNG GIAN XANH (Giữ nguyên)
  // ================================================================
  @Cron(CronExpression.EVERY_DAY_AT_3AM) 
  async handleGreenSpaceIngestion() {
    this.logger.log('Running Data Ingestion Agent for OpenStreetMap (Overpass)...');
    
    const bbox = '10.35,106.24,11.18,107.02'; 
    
    const overpassQuery = `
      [out:json][timeout:120];
      (
        way["leisure"="park"](${bbox});
        way["landuse"="recreation_ground"](${bbox});
        way["natural"="wood"](${bbox});
        relation["leisure"="park"](${bbox});
        relation["landuse"="recreation_ground"](${bbox});
        relation["natural"="wood"](${bbox});
      );
      out geom;
    `;
    
    try {
      const response = await firstValueFrom(
        this.httpService.post(this.overpassApiUrl, overpassQuery, {
          headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
        }),
      );

      const elements = response.data?.elements || [];
      if (elements.length === 0) {
        this.logger.warn('⚠️ Overpass API returned no green spaces for HCMC.');
        return;
      }

      let savedCount = 0;
      for (const element of elements) {
        if (element.type !== 'way' || !element.geometry) continue; 
        
        const entity = this.formatOverpassToEntity(element);
        if (!entity) continue;

        await this.greenSpaceRepository.save(entity);
        
        const ngsiLdPayload = this.formatGreenSpaceToNgsiLd(entity);
        await this.syncToOrionLD(ngsiLdPayload); // 👈 Sẽ gọi hàm sync đã sửa lỗi
        savedCount++;
      }
      this.logger.log(`✅ Successfully ingested and synced ${savedCount} green space(s).`);

    } catch (error) {
      // Lỗi đã được log bên trong syncToOrionLD
      if (!error.response?.data?.title?.includes('Invalid URI')) {
         this.logger.error('❌ Failed to ingest OpenStreetMap data', error.response?.data || error.message);
      }
    }
  }

  // ================================================================
  // 🧩 CÁC HÀM HELPER (Giữ nguyên)
  // ================================================================

  private formatOwmToAqiEntity(owmData: any): AirQualityObservation | null {
    // ... (Giữ nguyên logic OWM)
    if (!owmData || !owmData.components || !owmData.dt) {
      this.logger.warn(`Invalid OWM data received, skipping.`);
      return null;
    }
    const obs = new AirQualityObservation();
    obs.entity_id = this.HCMC_VIRTUAL_STATION_ID;
    obs.time = new Date(owmData.dt * 1000); 
    obs.location = {
      type: 'Point',
      coordinates: [this.HCMC_LON, this.HCMC_LAT],
    };
    obs.pm2_5 = owmData.components.pm2_5;
    obs.pm10 = owmData.components.pm10;
    obs.no2 = owmData.components.no2;
    obs.so2 = owmData.components.so2;
    obs.o3 = owmData.components.o3;
    obs.aqi = owmData.main.aqi;
    return obs;
  }
  
  private formatOverpassToEntity(element: any): UrbanGreenSpace | null {
    // ... (Giữ nguyên logic Overpass)
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

  /**
   * 🚀 HELPER ĐÃ SỬA LỖI: Thêm tiền tố URN vào ID
   */
  private formatGreenSpaceToNgsiLd(entity: UrbanGreenSpace): any {
    // 🚀 SỬA LỖI: Thêm tiền tố URN chuẩn vào ID
    const entityId = `urn:ngsi-ld:UrbanGreenSpace:${entity.entity_id}`;

    return {
      id: entityId, // 👈 FIX: Gửi ID đã có tiền tố
      type: 'UrbanGreenSpace',
      name: {
        type: 'Property',
        value: entity.name || 'Không rõ tên',
      },
      category: {
        type: 'Property',
        value: entity.category,
      },
      location: { 
        type: 'GeoProperty',
        value: entity.geom,
      },
      '@context': [
        'https://smartdatamodels.org/context.jsonld',
      ],
    };
  }

  private formatObservationToNgsiLd(obs: AirQualityObservation): any {
    // ... (Giữ nguyên logic format OWM)
    const payload = {
      id: obs.entity_id,
      type: 'AirQualityObserved',
      location: { type: 'GeoProperty', value: obs.location },
      dateObserved: { type: 'Property', value: { '@type': 'DateTime', '@value': obs.time.toISOString() } },
      aqi: { type: 'Property', value: obs.aqi },
      pm25: { type: 'Property', value: obs.pm2_5, unitCode: 'µg/m³' },
      pm10: { type: 'Property', value: obs.pm10, unitCode: 'µg/m³' },
      no2: { type: 'Property', value: obs.no2, unitCode: 'µg/m³' },
      so2: { type: 'Property', value: obs.so2, unitCode: 'µg/m³' },
      o3: { type: 'Property', value: obs.o3, unitCode: 'µg/m³' },
      '@context': ['https://smartdatamodels.org/context.jsonld'],
    };
    Object.keys(payload).forEach(key => {
      if (key === 'id' || key === 'type' || key === '@context') return;
      const prop = payload[key];
      if (prop && (prop.value === undefined || prop.value === null)) {
        delete payload[key];
      }
    });
    return payload;
  }

  // ================================================================
  // 🔄 ĐỒNG BỘ DỮ LIỆU NGSI-LD (Giữ nguyên - Đã fix ở bước trước)
  // ================================================================
  private async syncToOrionLD(payload: any) {
    try {
      await firstValueFrom(
        this.httpService.post(this.ORION_LD_URL, payload, {
          headers: { 'Content-Type': 'application/ld+json' },
        }),
      );
    } catch (error) {
      const status = error?.response?.status;
      if (status === 409 || status === 422) { 
        try {
          const patchPayload = { ...payload };
          delete patchPayload.id;
          delete patchPayload.type;
          
          const entityUrl = `${this.ORION_LD_URL}/${encodeURIComponent(payload.id)}/attrs`;
          
          await firstValueFrom(
            this.httpService.patch(entityUrl, patchPayload, {
              headers: { 'Content-Type': 'application/ld+json' },
            }),
          );
        } catch (patchErr) {
          this.logger.error(`Failed to PATCH existing entity ${payload.id}`, patchErr?.response?.data || patchErr?.message || patchErr);
        }
      } else {
        this.logger.error(`Failed to sync to Orion-LD (ID: ${payload.id})`, error?.response?.data || error?.message || error);
        throw error; 
      }
    }
  }

  // ================================================================
  // ⚠️ INCIDENT (Giữ nguyên logic)
  // ================================================================
  async createIncident(dto: CreateIncidentDto, userId: string): Promise<Incident> {
    // ... (Giữ nguyên)
    const newIncidentEntity = this.incidentRepository.create({
      ...dto,
      reported_by_user_id: userId,
      status: 'pending',
    });
    const savedIncident = await this.incidentRepository.save(newIncidentEntity);
    const ngsiLdPayload = this.formatIncidentToNgsiLd(savedIncident);
    await this.syncToOrionLD(ngsiLdPayload); 
    return savedIncident;
  }
  
  async findAllIncidents(): Promise<Incident[]> {
    // ... (Giữ nguyên)
    return this.incidentRepository.find({
      relations: ['reporter', 'incidentType'],
      order: { created_at: 'DESC' },
    });
  }

  private formatIncidentToNgsiLd(incident: Incident): any {
    // ... (Giữ nguyên)
    const entityId = `urn:ngsi-ld:Incident:${incident.incident_id}`;
    return {
      id: entityId,
      type: 'Incident',
      location: {
        type: 'GeoProperty',
        value: incident.location,
      },
      incidentType: {
        type: 'Property',
        value: `urn:ngsi-ld:IncidentType:${incident.incident_type_id}`,
      },
      description: {
        type: 'Property',
        value: incident.description || '',
      },
      status: {
        type: 'Property',
        value: incident.status,
      },
      dateReported: {
        type: 'Property',
        value: {
          '@type': 'DateTime',
          '@value': incident.created_at.toISOString(),
        },
      },
      reportedBy: {
        type: 'Relationship',
        object: `urn:ngsi-ld:User:${incident.reported_by_user_id}`,
      },
      '@context': ['https://smartdatamodels.org/context.jsonld'],
    };
  }
}