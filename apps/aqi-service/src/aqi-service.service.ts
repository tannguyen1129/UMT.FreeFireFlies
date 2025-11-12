import { Injectable, Logger, OnModuleInit } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository } from 'typeorm';
import { HttpService } from '@nestjs/axios';
import { ConfigService } from '@nestjs/config';
import { Cron } from '@nestjs/schedule'; 
import { firstValueFrom } from 'rxjs';
import { Incident } from './entities/incident.entity';
import { CreateIncidentDto } from './dto/create-incident.dto';
import { AirQualityObservation } from './entities/air-quality-observation.entity';
import { WeatherObservation } from './entities/weather-observation.entity';

@Injectable()
export class AqiServiceService implements OnModuleInit {
  private readonly logger = new Logger(AqiServiceService.name);
  private readonly ORION_LD_URL: string;
  private readonly OWM_API_KEY: string; 
  private readonly owmApiUrl = 'http://api.openweathermap.org/data/2.5/air_pollution';
  
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
      // Đã bắt lỗi bên trong handleOwmDataIngestion
    }
  }

  // ================================================================
  // 🔁 TÁC VỤ TỰ ĐỘNG THU THẬP DỮ LIỆU
  // ================================================================
  @Cron('*/15 * * * *')
  async handleOwmDataIngestion() {
    this.logger.log('Running Data Ingestion Agent for OpenWeatherMap (OWM)...');

    try {
      const response = await firstValueFrom(
        this.httpService.get(this.owmApiUrl, {
          headers: { 'Accept': 'application/json' },
          params: {
            lat: this.HCMC_LAT,
            lon: this.HCMC_LON,
            appid: this.OWM_API_KEY,
          },
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
  // 🧩 CHUYỂN ĐỔI DỮ LIỆU (Giữ nguyên)
  // ================================================================
  
  private formatOwmToAqiEntity(owmData: any): AirQualityObservation | null {
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

  // ================================================================
  // 🧠 CHUYỂN THÀNH NGSI-LD ENTITY (Đã Sửa Lỗi)
  // ================================================================
  private formatObservationToNgsiLd(obs: AirQualityObservation): any {
    const payload = {
      id: obs.entity_id,
      type: 'AirQualityObserved',
      location: {
        type: 'GeoProperty',
        value: obs.location,
      },
      dateObserved: {
        type: 'Property',
        value: { '@type': 'DateTime', '@value': obs.time.toISOString() },
      },
      aqi: { type: 'Property', value: obs.aqi },
      pm25: { type: 'Property', value: obs.pm2_5, unitCode: 'µg/m³' },
      pm10: { type: 'Property', value: obs.pm10, unitCode: 'µg/m³' },
      no2: { type: 'Property', value: obs.no2, unitCode: 'µg/m³' },
      so2: { type: 'Property', value: obs.so2, unitCode: 'µg/m³' },
      o3: { type: 'Property', value: obs.o3, unitCode: 'µg/m³' },
      '@context': [
        'https://smartdatamodels.org/context.jsonld',
      ],
    };
    
    // 🚀 SỬA LỖI: Chỉ xóa các thuộc tính nghiệp vụ (không xóa id, type, @context)
    Object.keys(payload).forEach(key => {
      // Bỏ qua các khóa metadata chính
      if (key === 'id' || key === 'type' || key === '@context') {
        return;
      }
      
      const prop = payload[key];
      // Xóa nếu 'value' bị null hoặc undefined
      if (prop && (prop.value === undefined || prop.value === null)) {
        delete payload[key];
      }
    });
    return payload;
  }

  // ================================================================
  // 🔄 ĐỒNG BỘ DỮ LIỆU NGSI-LD (Giữ nguyên)
  // ================================================================
  private async syncToOrionLD(payload: any) {
    try {
      await firstValueFrom(
        this.httpService.post(this.ORION_LD_URL, payload, {
          headers: {
            'Content-Type': 'application/ld+json',
          },
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
              headers: { 
                'Content-Type': 'application/ld+json', // 👈 Vẫn dùng ld+json
                // Sửa lỗi: Orion-LD v1.0.1 (image mới nhất) yêu cầu @context khi PATCH ld+json
                // 'Link': '...' // 👈 Bỏ Link header
              },
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
    return this.incidentRepository.find({
      relations: ['reporter', 'incidentType'],
      order: { created_at: 'DESC' },
    });
  }

  private formatIncidentToNgsiLd(incident: Incident): any {
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