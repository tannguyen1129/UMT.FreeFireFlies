import {
  Controller,
  Post,
  Get,
  UseGuards,
  Req,
  Body,
  ValidationPipe,
  Query,
} from '@nestjs/common';
import { AqiServiceService } from './aqi-service.service';
import { AuthGuard } from '@nestjs/passport';
import type { Request } from 'express';
import { CreateIncidentDto } from './dto/create-incident.dto';
import { Roles } from './roles.decorator'; 
import { RolesGuard } from './roles.guard'; 
import { RoutePlannerService } from './route-planner.service';
import { GetRecommendationDto } from './dto/get-recommendation.dto';
import { GetGreenSpacesDto } from './dto/get-green-spaces.dto';

@Controller('aqi') 
@UseGuards(AuthGuard('jwt'), RolesGuard)
export class AqiServiceController {
  constructor(
    private readonly aqiServiceService: AqiServiceService,
    private readonly routePlannerService: RoutePlannerService, 
  ) {}

  // --- API BÁO CÁO SỰ CỐ (ĐÃ CÓ) ---
  @Post('/incidents') 
  @Roles('citizen')
  async createIncident(
    @Req() req: Request,
    @Body(new ValidationPipe()) dto: CreateIncidentDto,
  ) {
    const userPayload = req.user as { userId: string };
    return this.aqiServiceService.createIncident(dto, userPayload.userId);
  }

  @Get('/incidents') 
  @Roles('admin', 'government_official')
  async findAllIncidents() {
    return this.aqiServiceService.findAllIncidents();
  }

  // 🚀 SỬA LỖI: Dùng '//' thay vì '/' cho chú thích
  // --- 🚀 API TÌM ĐƯỜNG (ĐÃ SỬA LẠI LOGIC) 🚀 --- 
  @Get('recommendations')
  @UseGuards(AuthGuard('jwt')) 
  async getRecommendations(
    @Query(new ValidationPipe({ transform: true })) dto: GetRecommendationDto,
  ) {
    // 1. Lấy các tuyến đường (từ ORS)
    const routesGeoJson = await this.routePlannerService.getRawRoutes(dto);
    
    // 2. Lấy dữ liệu dự báo AQI (từ Orion-LD)
    const forecastData = await this.routePlannerService.getForecastData();

    // 3. Chấm điểm các tuyến đường
    
    let pm25Score = 1000; // Điểm mặc định (cao là xấu)
    if (forecastData && forecastData.forecastedPM25) {
      pm25Score = forecastData.forecastedPM25.value;
    }

    // Gán điểm số vào từng tuyến đường
    const scoredRoutes = routesGeoJson.features.map((route: any, index: number) => {
      const durationInSeconds = route.properties.summary.duration;
      
      route.properties.exposureScore = pm25Score * durationInSeconds; 
      
      if (index === 0) {
        route.properties.routeType = 'fastest';
      } else {
        route.properties.routeType = 'alternative';
      }
      return route;
    });

    // Sắp xếp lại, cho tuyến "sạch nhất" (điểm thấp nhất) lên đầu
    routesGeoJson.features.sort((a, b) => a.properties.exposureScore - b.properties.exposureScore);

    // Gán lại tuyến "sạch nhất"
    if (routesGeoJson.features.length > 0) {
       routesGeoJson.features[0].properties.routeType = 'cleanest';
    }

    // 4. Trả về GeoJSON đã chấm điểm
    return routesGeoJson;
  }

  @Get('green-spaces') // 👈 TẠO ENDPOINT: GET /aqi/green-spaces
  @UseGuards(AuthGuard('jwt')) // Chỉ cần đăng nhập
  async findGreenSpaces(
    @Query(new ValidationPipe({ transform: true })) dto: GetGreenSpacesDto,
  ) {
    // Gọi service để thực hiện GeoQuery
    return this.routePlannerService.getNearbyGreenSpaces(dto);
  }
}
