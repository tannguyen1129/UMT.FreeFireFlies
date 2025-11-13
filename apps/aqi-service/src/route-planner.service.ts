import { Injectable, Logger } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { HttpService } from '@nestjs/axios';
import { firstValueFrom } from 'rxjs';
import { GetRecommendationDto } from './dto/get-recommendation.dto';

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
    // Lấy Key của Openrouteservice
    const orsKey = this.configService.get<string>('ORS_API_KEY');
    if (!orsKey) throw new Error('ORS_API_KEY is not defined in .env');
    this.orsApiKey = orsKey;

    // Lấy URL của Orion-LD
    const orionUrl = this.configService.get<string>('ORION_LD_URL');
    if (!orionUrl) throw new Error('ORION_LD_URL is not defined in .env');
    this.orionLdUrl = orionUrl;
  }

  /**
   * Bước 1: Gọi Openrouteservice (ORS) để lấy các tuyến đường
   */
  async getRawRoutes(dto: GetRecommendationDto): Promise<any> {
    const orsPayload = {
      coordinates: [
        [dto.startLng, dto.startLat],
        [dto.endLng, dto.endLat],
      ],
      alternative_routes: { target_count: 3 },
      elevation: true, // 👈 Yêu cầu thêm độ cao (nếu cần)
    };

    try {
      const response = await firstValueFrom(
        this.httpService.post(this.orsApiUrl, orsPayload, {
          headers: {
            'Authorization': this.orsApiKey,
            'Content-Type': 'application/json',
          },
        }),
      );
      // Trả về dữ liệu GeoJSON (chứa 1-3 tuyến đường)
      return response.data;
    } catch (error) {
      this.logger.error('Error calling Openrouteservice', error.response?.data);
      throw new Error('Failed to fetch routes from ORS');
    }
  }

  /**
   * Bước 2: Truy vấn Context Broker để lấy dữ liệu Dự báo AQI
   * (Chúng ta truy vấn 1 điểm trung tâm, vì mô hình AI hiện tại là đơn điểm)
   */
  async getForecastData(): Promise<any> {
    const forecastEntityId = 'urn:ngsi-ld:AirQualityForecast:HCMC-Central';
    const url = `${this.orionLdUrl}/${forecastEntityId}?attrs=forecastedPM25`;

    try {
      const response = await firstValueFrom(
        this.httpService.get(url, {
          headers: {
            'Accept': 'application/ld+json',
            'Link': '<https://smartdatamodels.org/context.jsonld>; rel="http://www.w3.org/ns/json-ld#context"; type="application/ld+json"'
          },
        }),
      );
      // Trả về { forecastedPM25: { type: 'Property', value: 3.47 } }
      return response.data; 
    } catch (error) {
      if (error.response?.status === 404) {
        this.logger.warn(`Forecast entity '${forecastEntityId}' not found in Orion-LD.`);
        return null;
      }
      this.logger.error('Error fetching forecast from Orion-LD', error.response?.data);
      throw new Error('Failed to fetch forecast data from Orion-LD');
    }
  }
}