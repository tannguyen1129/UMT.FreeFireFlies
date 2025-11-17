import {
  Controller,
  Post,
  Get,
  UseGuards,
  Req,
  Body,
  ValidationPipe,
  Query,
  HttpCode,
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
// @UseGuards(AuthGuard('jwt'), RolesGuard) 
export class AqiServiceController {
  constructor(
    private readonly aqiServiceService: AqiServiceService,
    private readonly routePlannerService: RoutePlannerService, 
  ) {}

  // --- API WEBHOOK MỚI (CHO ORION-LD) ---
  // Endpoint này phải CÔNG KHAI (public)
  @Post('/notify-user')
  @HttpCode(204) // Trả về 204 No Content (Rất quan trọng cho Webhook)
  async handleOrionNotification(@Body() payload: any) {
    // Không await, chạy trong nền
    this.aqiServiceService.handleAqiAlertNotification(payload);
    return; // Trả về 204 ngay lập tức
  }

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

  // --- API MỚI: LẤY LOẠI SỰ CỐ ---
  @Get('/incident-types') 
  @UseGuards(AuthGuard('jwt')) // Chỉ cần đăng nhập
  async findAllIncidentTypes() {
    return this.aqiServiceService.findAllIncidentTypes();
  }

  // --- API MỚI: LẤY DỮ LIỆU DỰ BÁO ---
  @Get('/forecasts') 
  @UseGuards(AuthGuard('jwt')) // Chỉ cần đăng nhập
  async findAllForecasts() {
    return this.aqiServiceService.findAllForecasts();
  }

  @Get('/incidents') 
  @Roles('admin', 'government_official')
  async findAllIncidents() {
    return this.aqiServiceService.findAllIncidents();
  }

  // --- API TÌM ĐƯỜNG (ĐÃ SỬA LỖI LOGIC) --- 
  @Get('recommendations')
  @UseGuards(AuthGuard('jwt')) 
  async getRecommendations(
    @Query(new ValidationPipe({ transform: true })) dto: GetRecommendationDto,
  ) {
    // 1. Lấy các tuyến đường (từ ORS)
    const routesGeoJson = await this.routePlannerService.getRawRoutes(dto);
    
    // 2. Lấy TẤT CẢ dữ liệu quan trắc (từ Orion-LD)
    const observations = await this.routePlannerService.getObservationData();

    // 3. Chấm điểm các tuyến đường (Logic mới)
    routesGeoJson.features.forEach((route: any, index: number) => {
      let totalExposure = 0; 
      
      const segments = route.properties.segments;
      const coordinates = route.geometry.coordinates; // [[lng, lat], ...]

      segments.forEach((segment: any) => {
        const duration = segment.duration; 
        
        const startPointIndex = segment.steps[0].way_points[0];
        const coord = coordinates[startPointIndex]; // [lng, lat]
        
        // SỬA LỖI: Dùng object đơn giản, không dùng class 'LatLng'
        const segmentMidPoint = { lat: coord[1], lng: coord[0] }; 

        const pm25Score = this.routePlannerService.interpolateAqAtPoint(
          segmentMidPoint,
          observations,
        );

        totalExposure += (pm25Score * duration);
      });

      route.properties.exposureScore = totalExposure; 
      
      if (index === 0) {
        route.properties.routeType = 'fastest';
      } else {
        route.properties.routeType = 'alternative';
      }
    });

    // Sắp xếp lại
    routesGeoJson.features.sort((a, b) => a.properties.exposureScore - b.properties.exposureScore);

    if (routesGeoJson.features.length > 0) {
       routesGeoJson.features[0].properties.routeType = 'cleanest';
    }

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