import { Injectable, Logger, BadRequestException, InternalServerErrorException } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { HttpService } from '@nestjs/axios';
import { firstValueFrom } from 'rxjs';
import { GetRecommendationDto } from './dto/get-recommendation.dto';
import { GetGreenSpacesDto } from './dto/get-green-spaces.dto';

type GeoPoint = { lat: number; lng: number };

@Injectable()
export class RoutePlannerService {
  private readonly logger = new Logger(RoutePlannerService.name);
  private readonly orsApiKey: string;
  private readonly orsApiUrl = 'https://api.openrouteservice.org/v2/directions/driving-car/geojson';
  private readonly orionLdUrl: string;

  constructor(
    private readonly configService: ConfigService,
    private readonly httpService: HttpService,
  ) {
    const orsKey = this.configService.get<string>('ORS_API_KEY');
    if (!orsKey) throw new Error('ORS_API_KEY is not defined in .env');
    this.orsApiKey = orsKey;

    const orionUrl = this.configService.get<string>('ORION_LD_URL');
    if (!orionUrl) throw new Error('ORION_LD_URL is not defined in .env');
    this.orionLdUrl = orionUrl;
  }

  /**
   * Bước 1: Gọi Openrouteservice (ORS) để lấy các tuyến đường
   */
  async getRawRoutes(dto: GetRecommendationDto): Promise<any> {
    // 🚀 DEBUG: In ra tọa độ nhận được để kiểm tra
    this.logger.warn(`[ORS Request] Start: [${dto.startLat}, ${dto.startLng}] -> End: [${dto.endLat}, ${dto.endLng}]`);

    // Kiểm tra nếu tọa độ bị 0,0 (Lỗi thường gặp ở Client)
    if ((dto.startLat === 0 && dto.startLng === 0) || (dto.endLat === 0 && dto.endLng === 0)) {
        throw new BadRequestException('Tọa độ không hợp lệ (0,0). Vui lòng kiểm tra lại GPS hoặc địa chỉ.');
    }

    const orsPayload = {
      coordinates: [
        [dto.startLng, dto.startLat], // ORS yêu cầu [Lng, Lat]
        [dto.endLng, dto.endLat],
      ],
      alternative_routes: { target_count: 3 },
      elevation: false, // Tắt elevation cho nhẹ
      radiuses: [1000, 1000] 
    };

    try {
      const response = await firstValueFrom(
        this.httpService.post(this.orsApiUrl, orsPayload, {
          headers: {
            'Authorization': this.orsApiKey,
            'Content-Type': 'application/json',
          },
          timeout: 15000, 
        }),
      );
      return response.data;

    } catch (error) {
      const orsError = error.response?.data?.error;
      
      if (orsError) {
        const code = orsError.code;
        const msg = orsError.message;

        this.logger.error(`[ORS API Error] Code: ${code}, Message: ${msg}`);

        if (code === 2010) {
          throw new BadRequestException('Không tìm thấy đường đi gần vị trí này (trong 1km).');
        }
        if (code === 2004) {
            // Log chi tiết hơn khi gặp lỗi khoảng cách
             this.logger.error(`[ORS Distance Error] Coordinates sent: ${JSON.stringify(orsPayload.coordinates)}`);
             throw new BadRequestException('Quãng đường quá xa (>6000km). Có thể tọa độ bị sai (0,0).');
        }
      }

      this.logger.error('Lỗi gọi Openrouteservice', error.message);
      throw new InternalServerErrorException('Lỗi dịch vụ tìm đường.');
    }
  }

  // ... (Các hàm getObservationData, getNearbyGreenSpaces, interpolate... giữ nguyên)
  async getObservationData(): Promise<any[]> {
    const params = {
      type: 'AirQualityObserved',
      limit: 100, 
      attrs: 'pm25,location'
    };

    try {
      const response = await firstValueFrom(
        this.httpService.get(this.orionLdUrl, { 
          params: params,
          headers: {
            'Accept': 'application/ld+json',
            'Link': '<https://smartdatamodels.org/context.jsonld>; rel="http://www.w3.org/ns/json-ld#context"; type="application/ld+json"'
          },
          timeout: 5000,
        }),
      );
      return response.data;
    } catch (error) {
      this.logger.error('Error fetching observations from Orion-LD', error.response?.data);
      return [];
    }
  }

  private getHaversineDistance(point1: GeoPoint, point2: GeoPoint): number {
    const R = 6371e3; 
    const phi1 = (point1.lat * Math.PI) / 180;
    const phi2 = (point2.lat * Math.PI) / 180;
    const deltaPhi = ((point2.lat - point1.lat) * Math.PI) / 180;
    const deltaLambda = ((point2.lng - point1.lng) * Math.PI) / 180;

    const a = Math.sin(deltaPhi / 2) * Math.sin(deltaPhi / 2) +
              Math.cos(phi1) * Math.cos(phi2) *
              Math.sin(deltaLambda / 2) * Math.sin(deltaLambda / 2);
    const c = 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1 - a));
    return R * c;
  }

  interpolateAqAtPoint(point: GeoPoint, observations: any[]): number {
    if (!observations || observations.length === 0) return 50;

    let closestDistance = Infinity;
    let closestPm25 = 50; 

    for (const obs of observations) {
      const coords = obs.location?.value?.coordinates; 
      const pm25 = obs.pm25?.value;

      if (!coords || pm25 === undefined) continue;

      const obsPoint: GeoPoint = { lat: coords[1], lng: coords[0] };
      const distance = this.getHaversineDistance(point, obsPoint); 

      if (distance < closestDistance) {
        closestDistance = distance;
        closestPm25 = pm25;
      }
    }
    return closestPm25;
  }
  
  async getNearbyGreenSpaces(dto: GetGreenSpacesDto): Promise<any> {
    const radius = dto.radius || 2000; 
    const params = {
      type: 'UrbanGreenSpace',
      georel: 'near;maxDistance==' + radius,
      geometry: 'Point',
      coordinates: `[${dto.lng}, ${dto.lat}]`,
      limit: 10 
    };
    try {
      const response = await firstValueFrom(
        this.httpService.get(this.orionLdUrl, {
          params: params, 
          headers: {
            'Accept': 'application/ld+json',
            'Link': '<https://smartdatamodels.org/context.jsonld>; rel="http://www.w3.org/ns/json-ld#context"; type="application/ld+json"'
          },
          timeout: 10000, 
        }),
      );
      return response.data; 
    } catch (error) {
      this.logger.error('Error performing GeoQuery for Green Spaces', error.response?.data);
      throw new Error('Failed to fetch green spaces from Orion-LD');
    }
  }

  async getNearbySensitiveAreas(dto: GetGreenSpacesDto): Promise<any> {
    const radius = dto.radius || 2000; 
    const params = {
      type: 'SensitiveArea', 
      georel: 'near;maxDistance==' + radius,
      geometry: 'Point',
      coordinates: `[${dto.lng}, ${dto.lat}]`,
      limit: 20 
    };
    try {
      const response = await firstValueFrom(
        this.httpService.get(this.orionLdUrl, {
          params: params, 
          headers: {
            'Accept': 'application/ld+json',
            'Link': '<https://smartdatamodels.org/context.jsonld>; rel="http://www.w3.org/ns/json-ld#context"; type="application/ld+json"'
          },
          timeout: 10000, 
        }),
      );
      return response.data; 
    } catch (error) {
      this.logger.error('Error performing GeoQuery for Sensitive Areas', error.response?.data);
      throw new Error('Failed to fetch sensitive areas from Orion-LD');
    }
  }
}