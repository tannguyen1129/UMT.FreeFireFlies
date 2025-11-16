import { Injectable, Logger } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { HttpService } from '@nestjs/axios';
import { firstValueFrom } from 'rxjs';
import { GetRecommendationDto } from './dto/get-recommendation.dto';
import { GetGreenSpacesDto } from './dto/get-green-spaces.dto';

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

  async getRawRoutes(dto: GetRecommendationDto): Promise<any> {
    this.logger.log('--- (Tầng 2) BƯỚC 1: Đã nhận request, đang gọi Openrouteservice (ORS)...'); // 👈 LOG MỚI
    
    const orsPayload = {
      coordinates: [
        [dto.startLng, dto.startLat],
        [dto.endLng, dto.endLat],
      ],
      alternative_routes: { target_count: 3 },
      elevation: true,
    };
    
    this.logger.log(`[ORS Request] Payload: ${JSON.stringify(orsPayload)}`); // 👈 LOG MỚI

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
      this.logger.log('--- (Tầng 2) BƯỚC 1: Gọi ORS THÀNH CÔNG.'); // 👈 LOG MỚI
      return response.data;
    } catch (error) {
      // 🚀 LOG LỖI CHI TIẾT
      this.logger.error('--- (Tầng 2) BƯỚC 1: LỖI KHI GỌI ORS ---');
      if (error.code === 'ECONNABORTED') {
        this.logger.error('[ORS Error] Request timed out after 15 seconds');
      } else {
        this.logger.error('[ORS Error] Lỗi chi tiết:', error.response?.data || error.message);
      }
      throw new Error('Failed to fetch routes from ORS');
    }
  }

  async getForecastData(): Promise<any> {
    this.logger.log('--- (Tầng 2) BƯỚC 2: Đang gọi Orion-LD (Dự báo)...'); // 👈 LOG MỚI
    const forecastEntityId = 'urn:ngsi-ld:AirQualityForecast:HCMC-Central';
    const url = `${this.orionLdUrl}/${forecastEntityId}?attrs=forecastedPM25`;

    try {
      const response = await firstValueFrom(
        this.httpService.get(url, {
          headers: {
            'Accept': 'application/ld+json',
            'Link': '<https://smartdatamodels.org/context.jsonld>; rel="http://www.w3.org/ns/json-ld#context"; type="application/ld+json"'
          },
          timeout: 5000,
        }),
      );
      this.logger.log('--- (Tầng 2) BƯỚC 2: Gọi Orion-LD THÀNH CÔNG.'); // 👈 LOG MỚI
      return response.data; 
    } catch (error) {
      // 🚀 LOG LỖI CHI TIẾT
      this.logger.error('--- (Tầng 2) BƯỚC 2: LỖI KHI GỌI Orion-LD ---');
      if (error.response?.status === 404) {
        this.logger.warn(`Forecast entity '${forecastEntityId}' not found in Orion-LD.`);
        return null;
      }
      this.logger.error('[Orion-LD Error] Lỗi chi tiết:', error.response?.data || error.message);
      throw new Error('Failed to fetch forecast data from Orion-LD');
    }
  }

  // ================================================================
  // 🌳 API TÌM KHÔNG GIAN XANH (MỚI)
  // ================================================================

  /**
   * Bước 3: Truy vấn Orion-LD để tìm các UrbanGreenSpace gần đó
   */
  async getNearbyGreenSpaces(dto: GetGreenSpacesDto): Promise<any> {
    const radius = dto.radius || 2000; 

    const params = {
      type: 'UrbanGreenSpace',
      georel: 'near;maxDistance==' + radius,
      geometry: 'Point',
      coordinates: `[${dto.lng}, ${dto.lat}]`,
      
      // 🚀 SỬA LỖI: THÊM GIỚI HẠN (LIMIT)
      // Chỉ yêu cầu 10 công viên gần nhất, thay vì 1006+
      limit: 10 
    };

    this.logger.log(`[GeoQuery] Finding top 10 green spaces near ${dto.lat},${dto.lng} within ${radius}m`);

    try {
      const response = await firstValueFrom(
        this.httpService.get(this.orionLdUrl, {
          params: params, 
          headers: {
            'Accept': 'application/ld+json',
            'Link': '<https://smartdatamodels.org/context.jsonld>; rel="http://www.w3.org/ns/json-ld#context"; type="application/ld+json"'
          },
          timeout: 10000, // 👈 Tăng timeout gọi Orion-LD lên 10 giây
        }),
      );
      
      return response.data; 

    } catch (error) {
      this.logger.error('Error performing GeoQuery for Green Spaces', error.response?.data);
      throw new Error('Failed to fetch green spaces from Orion-LD');
    }
  }
}