import { Controller, Get } from '@nestjs/common';
import { AqiServiceService } from './aqi-service.service';

@Controller()
export class AqiServiceController {
  constructor(private readonly aqiServiceService: AqiServiceService) {}

  @Get()
  getHello(): string {
    return this.aqiServiceService.getHello();
  }
}
