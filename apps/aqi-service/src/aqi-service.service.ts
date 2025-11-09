import { Injectable, Logger  } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Incident } from './entities/incident.entity';
import { Repository } from 'typeorm';
import { CreateIncidentDto } from './dto/create-incident.dto';
import { HttpService } from '@nestjs/axios'; 
import { firstValueFrom } from 'rxjs'; 

@Injectable()
export class AqiServiceService {
  private readonly logger = new Logger(AqiServiceService.name);
  private readonly ORION_LD_URL = 'http://localhost:1026/ngsi-ld/v1/entities';

  constructor(
    @InjectRepository(Incident)
    private readonly incidentRepository: Repository<Incident>,
    private readonly httpService: HttpService,
  ) {}

  /**
   * Tạo một báo cáo sự cố mới
   */
  async createIncident(dto: CreateIncidentDto, userId: string): Promise<Incident> {
    
    // === BƯỚC 1: LƯU VÀO POSTGRES (NHƯ CŨ) ===
    const newIncidentEntity = this.incidentRepository.create({
      ...dto,
      reported_by_user_id: userId,
      status: 'pending',
    });
    const savedIncident = await this.incidentRepository.save(newIncidentEntity);

    // === BƯỚC 2: ĐỒNG BỘ LÊN CONTEXT BROKER (MỚI) ===
    try {
      const ngsiLdPayload = this.formatToNgsiLd(savedIncident);
      
      // Giờ 'this.ORION_LD_URL' sẽ hợp lệ
      await firstValueFrom(
        this.httpService.post(this.ORION_LD_URL, ngsiLdPayload, {
          headers: { 
            'Content-Type': 'application/ld+json',
            'Link': '<https://smartdatamodels.org/context.jsonld>; rel="http://www.w3.org/ns/json-ld#context"; type="application/ld+json"'
          },
        }),
      );
      
      // Giờ 'this.logger' sẽ hợp lệ
      this.logger.log(`Successfully synced incident ${savedIncident.incident_id} to Orion-LD`);

    } catch (error) {
      // Giờ 'this.logger' sẽ hợp lệ
      this.logger.error(
        `Failed to sync incident ${savedIncident.incident_id} to Orion-LD`,
        error.response?.data || error.message,
      );
    }

    return savedIncident;
  }

  /**
   * Lấy danh sách tất cả sự cố (Giữ nguyên)
   */
  async findAllIncidents(): Promise<Incident[]> {
    return this.incidentRepository.find({
      relations: ['reporter', 'incidentType'],
      order: {
        created_at: 'DESC',
      },
    });
  }

  /**
   * HÀM MỚI: Định dạng dữ liệu sang chuẩn NGSI-LD
   */
  private formatToNgsiLd(incident: Incident): any {
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
        }
      },
      reportedBy: {
        type: 'Relationship',
        object: `urn:ngsi-ld:User:${incident.reported_by_user_id}`,
      },
      '@context': [
        'https://smartdatamodels.org/context.jsonld'
      ],
    };
  }
}