import { Controller, Get } from '@nestjs/common';

@Controller()
export class NotificationServiceController {
  @Get()
  getHealthCheck(): string {
    return 'Notification Service is running (Active Polling Mode)';
  }
}