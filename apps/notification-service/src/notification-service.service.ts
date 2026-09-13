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


import { Injectable, Logger, OnModuleInit } from '@nestjs/common';
import { Cron } from '@nestjs/schedule';
import { HttpService } from '@nestjs/axios';
import { firstValueFrom } from 'rxjs';
import { cert, getApps, initializeApp } from 'firebase-admin/app';
import { getMessaging } from 'firebase-admin/messaging';
import * as fs from 'fs';
import * as path from 'path';
import { ConfigService } from '@nestjs/config';

@Injectable()
export class NotificationServiceService implements OnModuleInit {
  private readonly logger = new Logger(NotificationServiceService.name);
   
  private readonly orionUrl: string;
  private readonly firebaseServiceAccountPath: string;

  private lastSentTime: Map<string, number> = new Map();
  private readonly COOLDOWN_MS = 30 * 60 * 1000; 

  constructor(
    private readonly httpService: HttpService,
    private readonly configService: ConfigService,
  ) {
    this.orionUrl = this.configService.getOrThrow<string>('ORION_LD_URL');
    this.firebaseServiceAccountPath = this.configService.get<string>(
      'FIREBASE_SERVICE_ACCOUNT_PATH',
      path.join(process.cwd(), 'apps/notification-service/firebase-admin-key.json'),
    );
  }

  onModuleInit() {
    try {
      this.logger.log(`🔍 Đang tìm Firebase credential tại đường dẫn đã cấu hình.`);

      if (!fs.existsSync(this.firebaseServiceAccountPath)) {
         throw new Error('❌ Firebase credential file không tồn tại');
      }

      const rawData = fs.readFileSync(this.firebaseServiceAccountPath, 'utf-8');
      const serviceAccount = JSON.parse(rawData);

      if (!getApps().length) {
        initializeApp({
          credential: cert(serviceAccount),
        });
        this.logger.log('✅ Firebase Admin Initialized successfully');
      }
    } catch (error) {
      // Log stack để dễ debug hơn
      this.logger.error('❌ Lỗi khởi tạo Firebase:', error);
    }
  }

  @Cron('*/1 * * * *') 
  async checkAirQualityAndNotify() {
    try {
      // Gọi Orion
      const response = await firstValueFrom(
        this.httpService.get(this.orionUrl, {
          params: { type: 'AirQualityForecast', limit: 100 },
          headers: { 
            'Link': '<https://smartdatamodels.org/context.jsonld>; rel="http://www.w3.org/ns/json-ld#context"; type="application/ld+json"',
            'Accept': 'application/ld+json'
          }
        })
      );

      const entities = response.data; 
      if (Array.isArray(entities)) {
        this.logger.log(`🔎 Tìm thấy ${entities.length} trạm dự báo.`);
        for (const entity of entities) {
          this.checkSingleStation(entity);
        }
      }

    } catch (error) {
      // SỬA LỖI LOGGING: In ra chi tiết lỗi thay vì chỉ "Error"
      if (error.code === 'ECONNREFUSED') {
        this.logger.error(`❌ Không thể kết nối tới Orion. Hãy kiểm tra ORION_LD_URL.`);
      } else {
        this.logger.error('❌ Lỗi khi tuần tra:', error.message || error);
      }
    }
  }

  private checkSingleStation(data: any) {
    const pm25 = data.forecastedPM25?.value;
    const timeStr = data.validFrom?.value?.['@value'];
    const stationId = data.id; 
    
    if (!pm25 || !timeStr) return;

    const districtName = stationId.split(':').pop().replace('OWM-', '');
    const lastTime = this.lastSentTime.get(districtName) || 0;
    const now = Date.now();
    
    if (now - lastTime < this.COOLDOWN_MS) return;
    
    if (pm25 > 40) {
      this.sendAlert(districtName, pm25, timeStr);
      this.lastSentTime.set(districtName, now); 
    }
  }

  private async sendAlert(location: string, pm25: number, time: string) {
    this.logger.warn(`🔔 --- PHÁT HIỆN KHÔNG KHÍ XẤU TẠI ${location.toUpperCase()} ---`);
    
    if (!getApps().length) {
      this.logger.error('⚠️ Bỏ qua gửi thông báo vì Firebase chưa khởi tạo thành công.');
      return;
    }

    const message = {
      notification: {
        title: '⚠️ Cảnh báo Chất lượng Không khí!',
        body: `Khu vực ${location} đang có chỉ số PM2.5 cao (${pm25} µg/m³). Hãy đeo khẩu trang!`,
      },
      topic: 'general_alerts', 
    };

    try {
      await getMessaging().send({
          notification: message.notification as any,
          topic: message.topic,
      });

      this.logger.log(`🚀 Đã bắn thông báo FCM thành công tới topic 'general_alerts'`);
    } catch (error) {
      this.logger.error('❌ Lỗi khi bắn FCM:', error);
    }
  }

  async sendIncidentNotification(userId: string, status: string, description: string) {
    if (!getApps().length) return;

    let title = 'Cập nhật Sự cố';
    let bodyMsg = `Báo cáo "${description}" của bạn đã được cập nhật.`;

    if (status === 'verified') {
      title = '✅ Báo cáo đã được Tiếp nhận';
      bodyMsg = 'Sự cố bạn báo cáo đã được xác minh và đang chờ xử lý.';
    } else if (status === 'resolved') {
      title = '🎉 Sự cố đã được Giải quyết!';
      bodyMsg = 'Cảm ơn đóng góp của bạn. Sự cố đã được xử lý xong.';
    } else if (status === 'rejected') {
      title = '❌ Báo cáo bị Từ chối';
      bodyMsg = 'Báo cáo của bạn không hợp lệ hoặc không thể xác minh.';
    }

    const message = {
      notification: {
        title: title,
        body: bodyMsg,
      },
      topic: `user_${userId}`,
    };

    try {
      await getMessaging().send(message);
      this.logger.log(`🚀 Đã gửi FCM tới user_${userId}: ${status}`);
    } catch (error) {
      this.logger.error(`❌ Lỗi gửi FCM Incident:`, error);
    }
  }
}
