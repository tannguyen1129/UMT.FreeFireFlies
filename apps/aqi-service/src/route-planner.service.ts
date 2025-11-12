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

  constructor(
  private readonly configService: ConfigService,
  private readonly httpService: HttpService,
) {
  // 🚀 SỬA LỖI Ở ĐÂY
  const apiKey = this.configService.get<string>('ORS_API_KEY'); // 1. Lấy ra biến tạm
  if (!apiKey) { // 2. Kiểm tra
    throw new Error('ORS_API_KEY is not defined in .env');
  }
  this.orsApiKey = apiKey; // 3. Gán giá trị (giờ đã an toàn)
}

  /**
   * Gọi API của Openrouteservice để lấy các tuyến đường
   */
  async getRoutes(dto: GetRecommendationDto): Promise<any> {
    const orsPayload = {
      // ⚠️ ORS dùng [longitude, latitude]
      coordinates: [
        [dto.startLng, dto.startLat],
        [dto.endLng, dto.endLat],
      ],
      // Yêu cầu 3 tuyến đường thay thế (như kế hoạch)
      alternative_routes: {
        target_count: 3, 
      },
    };

    try {
      const response = await firstValueFrom(
        this.httpService.post(this.orsApiUrl, orsPayload, {
          headers: {
            'Authorization': this.orsApiKey, // 👈 Sử dụng API Key
            'Content-Type': 'application/json',
          },
        }),
      );
      
      // Trả về dữ liệu GeoJSON chứa các tuyến đường
      return response.data;

    } catch (error) {
      this.logger.error('Error calling Openrouteservice', error.response?.data);
      throw new Error('Failed to fetch routes from ORS');
    }
  }
}