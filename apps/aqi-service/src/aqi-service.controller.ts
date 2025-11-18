import {
  Controller,
  Post,
  Get,
  Patch, 
  Put,    // 👈 Đã import
  Delete, // 👈 Đã import
  Param, 
  UseGuards,
  Req,
  Body,
  ValidationPipe,
  Query,
  HttpCode,
  ParseIntPipe, // 👈 Đã import
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
import { UpdateIncidentStatusDto } from './dto/update-incident-status.dto'; 
import { ManageIncidentTypeDto } from './dto/manage-incident-type.dto'; // 👈 Đã import

@Controller('aqi') 
// ⚠️ Bỏ UseGuards ở cấp Controller (để Webhook hoạt động)
export class AqiServiceController {
  constructor(
    private readonly aqiServiceService: AqiServiceService,
    private readonly routePlannerService: RoutePlannerService, 
  ) {}

  // --- API WEBHOOK (CHO ORION-LD) ---
  @Post('/notify-user')
  @HttpCode(204) 
  async handleOrionNotification(@Body() payload: any) {
    this.aqiServiceService.handleAqiAlertNotification(payload);
    return; 
  }

  // --- 🚀 API MỚI: TÌM KHU VỰC NHẠY CẢM ---
  @Get('sensitive-areas')
  @UseGuards(AuthGuard('jwt')) 
  async findSensitiveAreas(
    @Query(new ValidationPipe({ transform: true })) dto: GetGreenSpacesDto, 
    // (Tái sử dụng DTO GetGreenSpacesDto vì cũng cần lat, lng, radius)
  ) {
    // Gọi hàm service (bạn cần thêm hàm này vào route-planner.service.ts tương tự getNearbyGreenSpaces)
    return this.routePlannerService.getNearbySensitiveAreas(dto);
  }

  // ==================================================
  // API QUẢN LÝ LOẠI SỰ CỐ (ĐỀ XUẤT 2)
  // ==================================================
  
  @Get('/incident-types')
  @UseGuards(AuthGuard('jwt')) // Citizen cũng có thể xem
  async findAllIncidentTypes() {
    return this.aqiServiceService.findAllIncidentTypes();
  }
  
  // 🚀 HÀM MỚI (CHO ADMIN)
  @Post('/incident-types')
  @UseGuards(AuthGuard('jwt'), RolesGuard)
  @Roles('admin') // Chỉ Admin
  async createIncidentType(@Body(new ValidationPipe()) dto: ManageIncidentTypeDto) {
    return this.aqiServiceService.createIncidentType(dto);
  }

  // 🚀 HÀM MỚI (CHO ADMIN)
  @Put('/incident-types/:id')
  @UseGuards(AuthGuard('jwt'), RolesGuard)
  @Roles('admin') // Chỉ Admin
  async updateIncidentType(
    @Param('id', ParseIntPipe) id: number,
    @Body(new ValidationPipe()) dto: ManageIncidentTypeDto,
  ) {
    return this.aqiServiceService.updateIncidentType(id, dto);
  }

  // 🚀 HÀM MỚI (CHO ADMIN)
  @Delete('/incident-types/:id')
  @HttpCode(204)
  @UseGuards(AuthGuard('jwt'), RolesGuard)
  @Roles('admin') // Chỉ Admin
  async deleteIncidentType(@Param('id', ParseIntPipe) id: number) {
    return this.aqiServiceService.deleteIncidentType(id);
  }

  // ==================================================
  // API QUẢN LÝ SỰ CỐ (ĐÃ CÓ)
  // ==================================================

  @Get('/incidents/me') 
  @UseGuards(AuthGuard('jwt')) 
  async findMyIncidents(@Req() req: Request) {
    const user = req.user as { userId: string };
    return this.aqiServiceService.findMyIncidents(user.userId);
  }

  @Post('/incidents') 
  @UseGuards(AuthGuard('jwt'), RolesGuard) // 👈 Đã thêm Guard ở đây
  @Roles('citizen')
  async createIncident(
    @Req() req: Request,
    @Body(new ValidationPipe()) dto: CreateIncidentDto,
  ) {
    const userPayload = req.user as { userId: string };
    return this.aqiServiceService.createIncident(dto, userPayload.userId);
  }
  
  @Patch('/incidents/:id/status') 
  @UseGuards(AuthGuard('jwt'), RolesGuard)
  @Roles('admin', 'government_official')
  async updateIncidentStatus(
    @Param('id') id: string,
    @Body(new ValidationPipe()) dto: UpdateIncidentStatusDto,
  ) {
    return this.aqiServiceService.updateIncidentStatus(id, dto);
  }
  
  @Get('/incidents') 
  @UseGuards(AuthGuard('jwt'), RolesGuard) 
  @Roles('admin', 'government_official')
  async findAllIncidents() {
    return this.aqiServiceService.findAllIncidents();
  }

  // ==================================================
  // API TÍNH NĂNG (ĐÃ CÓ)
  // ==================================================

  @Get('/forecasts') 
  @UseGuards(AuthGuard('jwt'))
  async findAllForecasts() {
    return this.aqiServiceService.findAllForecasts();
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