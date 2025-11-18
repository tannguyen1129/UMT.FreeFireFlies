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
import { UrbanGreenSpace } from './entities/urban-green-space.entity';
import { IncidentType } from './entities/incident-type.entity'; 
import { ManageIncidentTypeDto } from './dto/manage-incident-type.dto';
import { UpdateIncidentStatusDto } from './dto/update-incident-status.dto';
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
  
  // 🚀 ĐỊNH NGHĨA CONTEXT CHUẨN
  private readonly NGSI_LD_CONTEXT = [
      'https://smartdatamodels.org/context.jsonld',
      'https://uri.etsi.org/ngsi-ld/v1/ngsi-ld-core-context-v1.7.jsonld'
  ];

  constructor(
    // Đảm bảo tất cả 4 Repositories đã được Inject
    @InjectRepository(Incident)
    private readonly incidentRepository: Repository<Incident>,
    @InjectRepository(IncidentType) // 👈 Bổ sung Repo
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
  // 🔁 AGENT 1: THU THẬP DỮ LIỆU OWM (Đã ổn định)
  // ================================================================
  @Cron('*/15 * * * *')  
  async handleOwmDataIngestion() {
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
      } else {
          this.logger.error('❌ Failed to ingest OWM data', error?.response?.data || error?.message || error);
      }
    }
  }

  // ================================================================
  // 🌳 AGENT 2: THU THẬP KHÔNG GIAN XANH (Đã ổn định)
  // ================================================================
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

  // ================================================================
  // 🧩 CÁC HÀM HELPER
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

  // 🚀 SỬA LỖI: Thêm @context nội tuyến
  private formatGreenSpaceToNgsiLd(entity: UrbanGreenSpace): any {
    const entityId = `urn:ngsi-ld:UrbanGreenSpace:${entity.entity_id}`;
    return {
      id: entityId, 
      type: 'UrbanGreenSpace',
      name: { type: 'Property', value: entity.name || 'Không rõ tên' },
      category: { type: 'Property', value: entity.category },
      location: { type: 'GeoProperty', value: entity.geom },
      '@context': this.NGSI_LD_CONTEXT, // 👈 SỬA: Dùng biến nội bộ
    };
  }

  // 🚀 SỬA LỖI: Thêm @context nội tuyến
  private formatObservationToNgsiLd(obs: AirQualityObservation): any {
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
      '@context': this.NGSI_LD_CONTEXT, // 👈 SỬA: Dùng biến nội bộ
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

  // ================================================================
  // 🔄 ĐỒNG BỘ DỮ LIỆU NGSI-LD (Đã Sửa Lỗi)
  // ================================================================
  private async syncToOrionLD(payload: any, entityId?: string) {
    const idToSync = entityId || payload.id;
    if (!idToSync) {
      this.logger.error('Sync to Orion-LD failed: No entity ID provided.');
      return;
    }

    // 🚀 TRƯỜNG HỢP 1: Đây là PATCH (entityId được truyền vào)
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
          this.httpService.patch(entityUrl, patchPayload, { // 👈 CHẠY PATCH
            headers: { 'Content-Type': 'application/ld+json' },
          }),
        );
      } catch (patchErr) {
        this.logger.error(`Failed to PATCH existing entity ${idToSync}`, patchErr?.response?.data || patchErr?.message || patchErr);
        throw patchErr; // Ném lỗi
      }
      return; // Kết thúc
    }

    // 🚀 TRƯỜNG HỢP 2: Đây là POST (payload có 'id' và không có entityId)
    // (Giống như từ createIncident, handleOwm, handleGreenSpace)
    try {
      const postPayload = { ...payload };
      if (!postPayload['@context']) {
          postPayload['@context'] = this.NGSI_LD_CONTEXT;
      }

      await firstValueFrom(
        this.httpService.post(this.ORION_LD_URL, postPayload, { // 👈 CHẠY POST
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

  // ================================================================
  // 📈 FORECAST (DỰ BÁO)
  // ================================================================
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
             // 🚀 SỬA LỖI: Bỏ 'Link' header (Orion-LD không thích nó khi GET)
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

  // ================================================================
  // ⚠️ INCIDENT (Đã sửa lỗi)
  // ================================================================
  
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

  /**
   * 🚀 HÀM MỚI: TẠO MỘT LOẠI SỰ CỐ (Đề xuất 2)
   */
  async createIncidentType(dto: ManageIncidentTypeDto): Promise<IncidentType> {
    this.logger.log(`--- (Tầng 2) Admin tạo Loại Sự cố mới: ${dto.type_name}`);
    const newType = this.incidentTypeRepository.create(dto);
    return this.incidentTypeRepository.save(newType);
  }

  /**
   * 🚀 HÀM MỚI: CẬP NHẬT MỘT LOẠI SỰ CỐ (Đề xuất 2)
   */
  async updateIncidentType(id: number, dto: ManageIncidentTypeDto): Promise<IncidentType> {
    this.logger.log(`--- (Tầng 2) Admin cập nhật Loại Sự cố ID: ${id}`);
    const type = await this.incidentTypeRepository.findOneBy({ type_id: id });
    if (!type) {
      throw new NotFoundException(`Không tìm thấy loại sự cố với ID: ${id}`);
    }
    
    // Cập nhật các trường
    type.type_name = dto.type_name;
    
    // 🚀 SỬA LỖI: Gán giá trị rỗng ('') nếu dto.description là undefined
    type.description = dto.description ?? ''; 
    
    return this.incidentTypeRepository.save(type);
  }

  /**
   * 🚀 HÀM MỚI: XÓA MỘT LOẠI SỰ CỐ (Đề xuất 2)
   */
  async deleteIncidentType(id: number): Promise<void> {
    this.logger.log(`--- (Tầng 2) Admin xóa Loại Sự cố ID: ${id}`);
    // TODO: Nên kiểm tra xem có incident nào đang dùng type này không trước khi xóa
    const result = await this.incidentTypeRepository.delete(id);
    if (result.affected === 0) {
      throw new NotFoundException(`Không tìm thấy loại sự cố với ID: ${id}`);
    }
  }

  // 🚀 HÀM MỚI: LẤY BÁO CÁO CỦA TÔI
  async findMyIncidents(userId: string): Promise<Incident[]> {
    this.logger.log(`--- (Tầng 2) User ${userId} yêu cầu lấy báo cáo CỦA TÔI...`);
    return this.incidentRepository.find({
      where: {
        reported_by_user_id: userId, // 👈 Chỉ lọc theo user ID
      },
      relations: ['incidentType'], // Lấy luôn tên loại sự cố
      order: { created_at: 'DESC' }, // Sắp xếp mới nhất lên đầu
    });
  }

  async updateIncidentStatus(incidentId: string, dto: UpdateIncidentStatusDto): Promise<Incident> {
    this.logger.log(`--- (Tầng 2) Đang cập nhật trạng thái Incident ID: ${incidentId} -> ${dto.status}`);

    const incident = await this.incidentRepository.findOneBy({ incident_id: incidentId });
    if (!incident) {
      throw new NotFoundException(`Không tìm thấy sự cố với ID: ${incidentId}`);
    }

    incident.status = dto.status;
    await this.incidentRepository.save(incident);
    
    const entityId = `urn:ngsi-ld:Incident:${incidentId}`;
    const patchPayload = {
      status: {
        type: 'Property',
        value: dto.status,
      },
      '@context': this.NGSI_LD_CONTEXT,
    };

    try {
      this.logger.log(`Đang PATCH trạng thái (Status) lên Orion-LD: ${entityId}`);
      // 🚀 SỬA LỖI: Truyền 2 tham số (để khớp với hàm syncToOrionLD đã sửa)
      await this.syncToOrionLD(patchPayload, entityId); 
      
    } catch (error) {
      this.logger.error(`Lỗi khi PATCH Incident Status lên Orion-LD`, error.message);
    }
    
    return incident;
  }

  // 🚀 SỬA LỖI: Thêm @context nội tuyến
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
      '@context': this.NGSI_LD_CONTEXT, // 👈 SỬA: Dùng biến nội bộ
    };
  }

  async handleAqiAlertNotification(payload: any) {
    this.logger.warn('--- (WEBHOOK) NHẬN ĐƯỢC CẢNH BÁO AQI TỪ ORION-LD ---');
    this.logger.log(JSON.stringify(payload, null, 2));

    const subscriptionId = payload.subscriptionId as string;
    const userId = subscriptionId.split(':')[3]; 
    const data = payload.data[0];
    const pm25 = data.forecastedPM25.value;
    
    this.logger.warn(`🔔 CẢNH BÁO CHO USER ${userId}: PM2.5 dự báo là ${pm25}! (Vượt ngưỡng)`);
    // TODO: Gửi Push Notification (Firebase)
    return;
  }
}