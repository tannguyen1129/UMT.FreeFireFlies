import { 
  Injectable, 
  Logger, 
  BadRequestException, // 👈 1. Import thêm
  BadGatewayException   // 👈 2. Import thêm
} from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { HttpService } from '@nestjs/axios';
import { firstValueFrom } from 'rxjs';
import { GetRecommendationDto } from './dto/get-recommendation.dto';
import { GetGreenSpacesDto } from './dto/get-green-spaces.dto';

// 🚀 Định nghĩa 1 kiểu (type) đơn giản cho tọa độ
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
   * 🚀 (HÀM ĐÃ SỬA LỖI)
   */
  async getRawRoutes(dto: GetRecommendationDto): Promise<any> {
    const orsPayload = {
      coordinates: [
        [dto.startLng, dto.startLat],
        [dto.endLng, dto.endLat],
      ],
      alternative_routes: { target_count: 3 },
      elevation: true,
    };

    try {
      const response = await firstValueFrom(
        this.httpService.post(this.orsApiUrl, orsPayload, {
          headers: {
            'Authorization': this.orsApiKey,
            'Content-Type': 'application/json',
          },
          timeout: 60000, 
        }),
      );
      return response.data;

    } catch (error) {
      
      // 🚀 BƯỚC 3: Xử lý lỗi một cách "mượt mà"
      
      // Kịch bản 1: Lỗi do người dùng chọn tọa độ không hợp lệ (Lỗi 2010)
      if (error.response?.data?.error?.code === 2010) {
        const orsMessage = error.response.data.error.message;
        this.logger.warn(`[ORS] Lỗi tọa độ không hợp lệ (2010): ${orsMessage}`);
        // Trả về lỗi 400 (Bad Request) cho client
        throw new BadRequestException(`Không thể tìm đường: ${orsMessage}. Vui lòng chọn điểm khác trên bản đồ.`);
      }

      // Kịch bản 2: Các lỗi khác từ ORS (ví dụ: 500, 401, 403)
      if (error.response) {
        this.logger.error('Lỗi không xác định từ Openrouteservice', error.response.data);
        // Trả về lỗi 502 (Bad Gateway) - Báo cho client biết lỗi từ dịch vụ bên ngoài
        throw new BadGatewayException('Dịch vụ tìm đường (ORS) đang gặp sự cố.');
      }
      
      // Kịch bản 3: Lỗi mạng (ví dụ: timeout)
      this.logger.error('Lỗi mạng khi gọi Openrouteservice', error.message);
      throw new BadGatewayException('Không thể kết nối đến dịch vụ tìm đường (ORS).');
    }
  }

  /**
   * Bước 2: Lấy dữ liệu Quan trắc (Observation)
   */
  async getObservationData(): Promise<any[]> {
    this.logger.log('--- (Tầng 2) BƯỚC 2: Đang gọi Orion-LD (Lấy dữ liệu Quan trắc)...');
    
    const params = {
      type: 'AirQualityObserved', // Lấy dữ liệu OWM
      limit: 100, 
      attrs: 'pm25,location' // Chỉ lấy thuộc tính cần thiết
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
      this.logger.log('--- (Tầng 2) BƯỚC 2: Gọi Orion-LD (Quan trắc) THÀNH CÔNG.');
      return response.data; // Trả về mảng các trạm
    } catch (error) {
      this.logger.error('Error fetching observations from Orion-LD', error.response?.data);
      return []; // Trả về mảng rỗng nếu lỗi
    }
  }

  /**
   * Helper: Tính khoảng cách Haversine
   */
  private getHaversineDistance(point1: GeoPoint, point2: GeoPoint): number {
    const R = 6371e3; // Mét
    const phi1 = (point1.lat * Math.PI) / 180;
    const phi2 = (point2.lat * Math.PI) / 180;
    const deltaPhi = ((point2.lat - point1.lat) * Math.PI) / 180;
    const deltaLambda = ((point2.lng - point1.lng) * Math.PI) / 180;

    const a =
      Math.sin(deltaPhi / 2) * Math.sin(deltaPhi / 2) +
      Math.cos(phi1) *
        Math.cos(phi2) *
        Math.sin(deltaLambda / 2) *
        Math.sin(deltaLambda / 2);
    const c = 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1 - a));

    return R * c; // (mét)
  }

  /**
   * Helper: Nội suy AQI (Tìm điểm gần nhất)
   */
  interpolateAqAtPoint(point: GeoPoint, observations: any[]): number {
    if (!observations || observations.length === 0) {
      return 50; // Giá trị mặc định (trung bình/xấu)
    }

    let closestDistance = Infinity;
    let closestPm25 = 50; 

    for (const obs of observations) {
      const coords = obs.location?.value?.coordinates; // [lng, lat]
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
  
  // --- Hàm Tìm Công viên (Giữ nguyên) ---
  async getNearbyGreenSpaces(dto: GetGreenSpacesDto): Promise<any> {
    const radius = dto.radius || 2000; 
    const params = {
      type: 'UrbanGreenSpace',
      georel: 'near;maxDistance==' + radius,
      geometry: 'Point',
      coordinates: `[${dto.lng}, ${dto.lat}]`,
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
          timeout: 10000, 
        }),
      );
      return response.data; 
    } catch (error) {
      this.logger.error('Error performing GeoQuery for Green Spaces', error.response?.data);
      throw new Error('Failed to fetch green spaces from Orion-LD');
    }
  }

  // --- TÌM KHU VỰC NHẠY CẢM (TRƯỜNG HỌC, BỆNH VIỆN...) ---
  async getNearbySensitiveAreas(dto: GetGreenSpacesDto): Promise<any> {
    const radius = dto.radius || 2000; // Mặc định 2km
    
    const params = {
      type: 'SensitiveArea', // 👈 CHỈ ĐỔI TYPE
      georel: 'near;maxDistance==' + radius,
      geometry: 'Point',
      coordinates: `[${dto.lng}, ${dto.lat}]`,
      limit: 20 // Lấy tối đa 20 địa điểm
    };

    this.logger.log(`[GeoQuery] Finding Sensitive Areas near ${dto.lat},${dto.lng} within ${radius}m`);
    
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