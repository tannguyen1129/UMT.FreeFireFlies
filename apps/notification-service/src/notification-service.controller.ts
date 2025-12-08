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