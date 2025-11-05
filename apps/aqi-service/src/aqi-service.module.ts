import { Module } from '@nestjs/common';
import { AqiServiceController } from './aqi-service.controller';
import { AqiServiceService } from './aqi-service.service';

@Module({
  imports: [],
  controllers: [AqiServiceController],
  providers: [AqiServiceService],
})
export class AqiServiceModule {}
