import { Controller, Get } from '@nestjs/common';
import { NotificationServiceService } from './notification-service.service';

@Controller()
export class NotificationServiceController {
  constructor(private readonly notificationService: NotificationServiceService) {}

  // API kiểm tra sức khỏe Service (Health Check)
  @Get()
  getHealthCheck(): string {
    return 'Notification Service is running (Mode: Active Polling)';
  }
}