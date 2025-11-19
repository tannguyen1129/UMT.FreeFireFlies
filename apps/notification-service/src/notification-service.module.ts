import { Module } from '@nestjs/common';
import { ScheduleModule } from '@nestjs/schedule'; 
import { HttpModule } from '@nestjs/axios'; 
import { NotificationServiceController } from './notification-service.controller';
import { NotificationServiceService } from './notification-service.service';

@Module({
  imports: [
    ScheduleModule.forRoot(), 
    HttpModule, 
  ],
  controllers: [NotificationServiceController],
  providers: [NotificationServiceService],
})
export class NotificationServiceModule {}