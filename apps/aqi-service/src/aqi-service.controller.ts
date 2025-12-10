/*
 * Copyright 2025 Green-AQI Navigator Team
 *
 * Licensed under the Apache License, Version 2.0 (the "License");
 * you may not use this file except in compliance with the License.
 * You may obtain a copy of the License at
 *
 * http://www.apache.org/licenses/LICENSE-2.0
 *
 * Unless required by applicable law or agreed to in writing, software
 * distributed under the License is distributed on an "AS IS" BASIS,
 * WITHOUT WARRANTIES OR CONDITIONS OF ANY KIND, either express or implied.
 * See the License for the specific language governing permissions and
 * limitations under the License.
 */


import {
  Controller,
  Post,
  Get,
  Patch, 
  Put,    
  Delete, 
  Param, 
  UseGuards,
  Req,
  Body,
  ValidationPipe,
  Query,
  HttpCode,
  ParseIntPipe,
  UseInterceptors, 
  UploadedFile, 
  BadRequestException 
} from '@nestjs/common';
import { FileInterceptor } from '@nestjs/platform-express';
import { diskStorage } from 'multer';
import { extname } from 'path';
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
import { ManageIncidentTypeDto } from './dto/manage-incident-type.dto';
import { CreatePerceptionDto } from './dto/create-perception.dto';

@Controller('aqi') 

export class AqiServiceController {
  constructor(
    private readonly aqiServiceService: AqiServiceService,
    private readonly routePlannerService: RoutePlannerService, 
  ) {}

  // --- API MỚI: BÁO CÁO CẢM NHẬN ---
  @Post('/perceptions')
  @UseGuards(AuthGuard('jwt'))
  async createPerception(
    @Req() req: Request,
    @Body(new ValidationPipe()) dto: CreatePerceptionDto,
  ) {
    const user = req.user as { userId: string };
    return this.aqiServiceService.createPerception(dto, user.userId);
  }

  @Get('/analytics')
  @UseGuards(AuthGuard('jwt'), RolesGuard)
  @Roles('admin', 'government_official') // Chỉ Admin/Gov mới xem được
  async getAnalytics() {
    return this.aqiServiceService.getAnalyticsData();
  }

  @Get('/perceptions')
  @UseGuards(AuthGuard('jwt'))
  async findAllPerceptions() {
    return this.aqiServiceService.findAllPerceptions();
  }

  // --- API MỚI: UPLOAD ẢNH ---
  @Post('upload')
  @UseGuards(AuthGuard('jwt')) // Chỉ user đăng nhập mới được up
  @UseInterceptors(FileInterceptor('file', {
    storage: diskStorage({
      destination: './uploads', 
      filename: (req, file, callback) => {
        const uniqueSuffix = Date.now() + '-' + Math.round(Math.random() * 1e9);
        const ext = extname(file.originalname);
        callback(null, `${file.fieldname}-${uniqueSuffix}${ext}`);
      },
    }),
    limits: { fileSize: 5 * 1024 * 1024 }, // Giới hạn 5MB
  }))
  async uploadFile(@UploadedFile() file: Express.Multer.File) {
    if (!file) {
      throw new BadRequestException('Không có file nào được tải lên');
    }
    
    // Trả về đường dẫn đầy đủ để Frontend lưu vào DB
    // Lưu ý: Thay localhost bằng IP Tĩnh WSL (172.27.144.1) hoặc IP Public VPS
    const serverUrl = 'http://172.27.144.1:3002'; 
    return { 
      url: `${serverUrl}/uploads/${file.filename}` 
    };
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
    // 1. Lấy dữ liệu đường đi (ORS)
    const routesGeoJson = await this.routePlannerService.getRawRoutes(dto);
    
    // 2. Lấy dữ liệu quan trắc (Orion-LD)
    const observations = await this.routePlannerService.getObservationData();

    // 3. Tính toán chi tiết từng điểm
    routesGeoJson.features.forEach((route: any, index: number) => {
      let totalExposure = 0; // Tích lũy: (PM2.5 * Thời gian đi qua)
      const coordinates = route.geometry.coordinates; // [[lng, lat], ...]
      const pointAqis: number[] = []; // Mảng lưu PM2.5 của từng điểm

      // Lấy tổng thời gian (giây) và tổng khoảng cách (mét)
      const totalDuration = route.properties.summary.duration;
      const totalDistance = route.properties.summary.distance;
      // Ước lượng thời gian đi qua mỗi đoạn nhỏ (giả sử tốc độ đều)
      const timePerPoint = totalDuration / coordinates.length;

      coordinates.forEach((coord: number[]) => {
        const point = { lat: coord[1], lng: coord[0] }; 
        
        // Nội suy PM2.5 tại điểm này
        const pm25 = this.routePlannerService.interpolateAqAtPoint(point, observations);
        
        pointAqis.push(pm25); // Lưu lại để vẽ màu
        
        // Cộng dồn vào tổng lượng bụi hấp thụ (Liều lượng = Nồng độ * Thời gian)
        totalExposure += (pm25 * timePerPoint);
      });

      // Gắn dữ liệu vào response
      route.properties.exposureScore = totalExposure; // Để sắp xếp
      route.properties.exposureValue = Math.round(totalExposure); // Để hiển thị (VD: 1500)
      route.properties.avgPm25 = (pointAqis.reduce((a,b)=>a+b,0) / pointAqis.length).toFixed(1);
      route.properties.pointAqis = pointAqis; // <--- MẢNG QUAN TRỌNG ĐỂ VẼ MÀU
      
      // Gán loại đường
      if (index === 0) route.properties.routeType = 'fastest';
      else route.properties.routeType = 'alternative';
    });

    // Sắp xếp: Ưu tiên đường có Lượng bụi tích lũy thấp nhất
    routesGeoJson.features.sort((a, b) => a.properties.exposureScore - b.properties.exposureScore);

    // Gán nhãn Cleanest cho đường tốt nhất
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