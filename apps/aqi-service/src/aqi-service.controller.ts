import {
  Controller,
  Post,
  Get,
  UseGuards,
  Req,
  Body,
  ValidationPipe,
} from '@nestjs/common';
import { AqiServiceService } from './aqi-service.service';
import { AuthGuard } from '@nestjs/passport';
import type { Request } from 'express';
import { CreateIncidentDto } from './dto/create-incident.dto';
import { Roles } from './roles.decorator'; 
import { RolesGuard } from './roles.guard'; 

@Controller('incidents') 
@UseGuards(AuthGuard('jwt'), RolesGuard)
export class AqiServiceController {
  constructor(private readonly aqiServiceService: AqiServiceService) {}

  @Post() 
  @Roles('citizen')
  @UseGuards(AuthGuard('jwt')) 
  async createIncident(
    @Req() req: Request,
    @Body(new ValidationPipe()) dto: CreateIncidentDto,
  ) {
    // Lấy userId từ payload của token
    const userPayload = req.user as { userId: string };

    return this.aqiServiceService.createIncident(dto, userPayload.userId);
  }
  @Get()
  @Roles('admin', 'government_official') 
  async findAllIncidents() {
    return this.aqiServiceService.findAllIncidents();
  }
}