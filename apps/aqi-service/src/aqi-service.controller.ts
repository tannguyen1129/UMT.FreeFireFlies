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

@Controller('aqi') // 👈 ĐỔI TÊN CONTROLLER (hoặc tạo file mới)
@UseGuards(AuthGuard('jwt'), RolesGuard)
export class AqiServiceController {
  constructor(
    private readonly aqiServiceService: AqiServiceService,
    private readonly routePlannerService: RoutePlannerService, 
  ) {}

  // --- API BÁO CÁO SỰ CỐ (ĐÃ CÓ) ---
  @Post('/incidents') // 👈 Cập nhật đường dẫn
  @Roles('citizen')
  async createIncident(
    @Req() req: Request,
    @Body(new ValidationPipe()) dto: CreateIncidentDto,
  ) {
    const userPayload = req.user as { userId: string };
    return this.aqiServiceService.createIncident(dto, userPayload.userId);
  }

  @Get('/incidents') // 👈 Cập nhật đường dẫn
  @Roles('admin', 'government_official')
  async findAllIncidents() {
    return this.aqiServiceService.findAllIncidents();
  }

  // --- 🚀 API MỚI: TÌM ĐƯỜNG 🚀 ---
  @Get('recommendations') // 👈 TẠO ENDPOINT: GET /aqi/recommendations
  @UseGuards(AuthGuard('jwt')) // Chỉ cần đăng nhập là được
  async getRecommendations(
    // Dùng ValidationPipe để tự động kiểm tra và chuyển đổi (transform)
    @Query(new ValidationPipe({ transform: true })) dto: GetRecommendationDto,
  ) {
    // 1. Gọi ORS để lấy tuyến đường
    const routes = await this.routePlannerService.getRoutes(dto);

    // 2. TODO: Phân tích AQI (làm ở bước sau)

    // 3. Trả về các tuyến đường GeoJSON
    return routes;
  }
}