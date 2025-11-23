import { Body, Controller, Post, Get, HttpCode, Logger } from '@nestjs/common';
import { NotificationServiceService } from './notification-service.service';

@Controller()
export class NotificationServiceController {

  private readonly logger = new Logger(NotificationServiceController.name);

  constructor(private readonly notificationService: NotificationServiceService) {}

  @Get()
  getHealthCheck(): string {
    return 'Notification Service is running (Active Polling Mode)';
  }

  // API MỚI: Gửi thông báo cập nhật sự cố
  @Post('notify-incident')
  @HttpCode(200)
  async notifyIncidentUpdate(@Body() body: { userId: string; status: string; description: string }) {
    this.logger.log(`📩 Yêu cầu gửi thông báo cho User ${body.userId}: ${body.status}`);
    
 
    await this.notificationService.sendIncidentNotification(body.userId, body.status, body.description);
    
    return { success: true };
  }
}