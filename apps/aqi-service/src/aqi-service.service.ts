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
import { IncidentType } from './entities/incident-type.entity';
import type { Polygon } from 'geojson'; 
import { URLSearchParams } from 'url';
import { RoutePlannerService } from './route-planner.service';

@Injectable()
export class AqiServiceService implements OnModuleInit {
  private readonly logger = new Logger(AqiServiceService.name);
  private readonly ORION_LD_URL: string;
  private readonly OWM_API_KEY: string; 
  private readonly owmApiUrl = 'http://api.openweathermap.org/data/2.5/air_pollution';
  private readonly overpassApiUrl = 'http://overpass-api.de/api/interpreter';
  
  private readonly HCMC_LAT = 10.7769;
  private readonly HCMC_LON = 106.7009;
  private readonly HCMC_VIRTUAL_STATION_ID = 'urn:ngsi-ld:AirQualityStation:HCMC-Central-OWM';

  // 1. ĐỊNH NGHĨA CONTEXT HEADER CHUẨN (Giữ nguyên)
  private readonly NGSI_LD_CONTEXT = '<https://smartdatamodels.org/context.jsonld>; rel="http://www.w3.org/ns/json-ld#context"; type="application/ld+json"';

  constructor(
    // ... (Constructor giữ nguyên)
    @InjectRepository(Incident)
    private readonly incidentRepository: Repository<Incident>,
    @InjectRepository(IncidentType)
    private readonly incidentTypeRepository: Repository<IncidentType>,
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
    // ... (onModuleInit giữ nguyên)
    this.logger.log('AqiServiceModule initialized.');
    this.logger.log('Triggering initial OWM data ingestion...');
    try {
      await this.handleOwmDataIngestion();
    } catch (err) { }
    
    this.logger.log('Triggering initial Green Space ingestion...');
    try {
      await this.handleGreenSpaceIngestion();
    } catch (err) { }
  }

  // ================================================================
  // 🔁 AGENT 1: THU THẬP DỮ LIỆU OWM (Giữ nguyên)
  // ================================================================
  @Cron('*/15 * * * *') 
  async handleOwmDataIngestion() {
    // ... (Hàm này giữ nguyên)
    this.logger.log('Running Data Ingestion Agent for OpenWeatherMap (OWM)...');
    try {
      const response = await firstValueFrom(
        this.httpService.get(this.owmApiUrl, {
          headers: { 'Accept': 'application/json' },
          params: { lat: this.HCMC_LAT, lon: this.HCMC_LON, appid: this.OWM_API_KEY },
          timeout: 10000, 
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
      if (error.code === 'ECONNABORTED') {
         this.logger.error('❌ Failed to ingest OWM data: Request timed out');
      } else if (!error.response?.data?.title?.includes('Entity id is missing')) {
          this.logger.error('❌ Failed to ingest OWM data', error?.response?.data || error?.message || error);
      }
    }
  }

  // ================================================================
  // 🌳 AGENT 2: THU THẬP KHÔNG GIAN XANH (Sửa lỗi Timeout 504)
  // ================================================================
  @Cron(CronExpression.EVERY_DAY_AT_3AM) 
  async handleGreenSpaceIngestion() {
    this.logger.log('Running Data Ingestion Agent for OpenStreetMap (Overpass)...');
    
    const bbox = '10.35,106.24,11.18,107.02'; 
    
    // 🚀 SỬA 1: Tăng thời gian chờ của server lên 120 giây (2 phút)
    const overpassQuery = `
      [out:json][timeout:120]; 
      (
        way["leisure"="park"](${bbox});
      );
      out geom;
    `;

    const params = new URLSearchParams();
    params.append('data', overpassQuery.trim()); 

    try {
      const response = await firstValueFrom(
        this.httpService.post(this.overpassApiUrl, params, { 
          headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
          // 🚀 SỬA 2: Tăng thời gian chờ của client (axios) lên 120 giây
          timeout: 120000,
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
      // 🚀 SỬA 3: Bổ sung log cho lỗi 504
      if (error.response?.status === 504) {
         this.logger.error('❌ Failed to ingest OpenStreetMap data: Server timed out (504 Gateway Timeout). Query is too heavy or server is overloaded.');
      } else if (error.code === 'ECONNABORTED') {
         this.logger.error('❌ Failed to ingest OpenStreetMap data: Client timed out (120s)');
      } else {
         this.logger.error('❌ Failed to ingest OpenStreetMap data (Full Error):', error.stack);
      }
    }
  }

  // ================================================================
  // 🧩 CÁC HÀM HELPER (Giữ nguyên)
  // ================================================================

  private formatOwmToAqiEntity(owmData: any): AirQualityObservation | null {
    // ... (Giữ nguyên)
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
    // ... (Giữ nguyên)
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

  private formatGreenSpaceToNgsiLd(entity: UrbanGreenSpace): any {
    // ... (Giữ nguyên, không có @context)
    const entityId = `urn:ngsi-ld:UrbanGreenSpace:${entity.entity_id}`;

    return {
      id: entityId, 
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
    };
  }

  private formatObservationToNgsiLd(obs: AirQualityObservation): any {
    // ... (Giữ nguyên, không có @context)
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
  // 🔄 ĐỒNG BỘ DỮ LIỆU NGSI-LD (ĐÃ SỬA)
  // ================================================================
  private async syncToOrionLD(payload: any) {
    try {
      await firstValueFrom(
        this.httpService.post(this.ORION_LD_URL, payload, {
          headers: { 
            // 🚀 SỬA LỖI: ĐỔI 'application/ld+json' thành 'application/json'
            'Content-Type': 'application/json',
            'Link': this.NGSI_LD_CONTEXT // Giữ nguyên Link header
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
                // 🚀 SỬA LỖI: ĐỔI 'application/ld+json' thành 'application/json'
                'Content-Type': 'application/json',
                'Link': this.NGSI_LD_CONTEXT // Giữ nguyên Link header
              },
            }),
          );
        } catch (patchErr) {
          this.logger.error(`Failed to PATCH existing entity ${payload.id}`, patchErr?.response?.data || patchErr?.message || patchErr);
        }
      } else {
         // Log lỗi chi tiết từ Orion (giống như lỗi 400 bạn vừa thấy)
         this.logger.error(`Failed to sync to Orion-LD (ID: ${payload.id})`, error?.response?.data || error?.message);
        throw error; 
      }
    }
  }

 // ================================================================
  // 📈 FORECAST (DỰ BÁO)
  // ================================================================

  /**
   * Truy vấn Orion-LD để lấy tất cả các thực thể AirQualityForecast
   * (Do Module AI tạo ra)
   */
  async findAllForecasts(): Promise<any> {
    this.logger.log('--- (Tầng 2) Yêu cầu lấy danh sách Dự báo (Forecasts)...');
    
    const params = {
      type: 'AirQualityForecast', // 👈 Lọc theo loại
      limit: 100 // Lấy 100 dự báo mới nhất (an toàn)
    };
    
    try {
      const response = await firstValueFrom(
        this.httpService.get(this.ORION_LD_URL, { // 👈 Gọi /entities
          params: params,
          headers: {
            'Accept': 'application/ld+json',
            'Link': '<https://smartdatamodels.org/context.jsonld>; rel="http://www.w3.org/ns/json-ld#context"; type="application/ld+json"'
          },
          timeout: 5000,
        }),
      );
      
      // Trả về một mảng các thực thể AirQualityForecast
      return response.data; 

    } catch (error) {
      this.logger.error('Error fetching forecasts from Orion-LD', error.response?.data);
      throw new Error('Failed to fetch forecasts from Orion-LD');
    }
  }

  // ================================================================
  // 🚀 LOGIC MỚI: XỬ LÝ WEBHOOK TỪ ORION-LD
  // ================================================================
  async handleAqiAlertNotification(payload: any) {
    this.logger.warn('--- (WEBHOOK) NHẬN ĐƯỢC CẢNH BÁO AQI TỪ ORION-LD ---');
    
    // Log toàn bộ payload (dạng thô)
    this.logger.log(JSON.stringify(payload, null, 2));

    // Lấy ID người dùng từ ID của Subscription
    const subscriptionId = payload.subscriptionId as string;
    const userId = subscriptionId.split(':')[3]; // Lấy phần 'userId' từ 'urn:ngsi-ld:Subscription:User:userId:AQIAlert'

    // Lấy dữ liệu vi phạm
    const data = payload.data[0];
    const pm25 = data.forecastedPM25.value;
    
    this.logger.warn(`🔔 CẢNH BÁO CHO USER ${userId}: PM2.5 dự báo là ${pm25}! (Vượt ngưỡng)`);

    // TODO (Bước tiếp theo):
    // 1. Dùng userId để tìm FCM Token (token điện thoại) của người dùng (từ bảng user_devices).
    // 2. Gửi Push Notification (Firebase) đến điện thoại của user đó.

    return;
  }

  // ================================================================
  // ⚠️ INCIDENT (ĐÃ SỬA)
  // ================================================================
  
  async createIncident(dto: CreateIncidentDto, userId: string): Promise<Incident> {
    // ... (Hàm này giữ nguyên)
    this.logger.log(`--- (Tầng 2) BƯỚC 1: Nhận được request tạo Incident từ user: ${userId}`);
    this.logger.log(`--- (Tầng 2) Payload DTO: ${JSON.stringify(dto)}`);
    
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
    // ... (Giữ nguyên)
    return this.incidentRepository.find({
      relations: ['reporter', 'incidentType'],
      order: { created_at: 'DESC' },
    });
  }

  async findAllIncidentTypes(): Promise<IncidentType[]> {
    // ... (Giữ nguyên)
    this.logger.log('--- (Tầng 2) Yêu cầu lấy danh sách Loại Sự cố...');
    return this.incidentTypeRepository.find();
  }

  private formatIncidentToNgsiLd(incident: Incident): any {
    // ... (Giữ nguyên, không có @context)
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
    };
  }
}