import { Injectable, Logger, OnModuleInit } from '@nestjs/common';
import { Cron } from '@nestjs/schedule';
import { HttpService } from '@nestjs/axios';
import { firstValueFrom } from 'rxjs';
import * as admin from 'firebase-admin';
import * as fs from 'fs';
import * as path from 'path';

@Injectable()
export class NotificationServiceService implements OnModuleInit {
  private readonly logger = new Logger(NotificationServiceService.name);
   
  // Hãy thay 'fiware-orion' bằng tên service của Orion trong file docker-compose.yml của bạn.
  private readonly ORION_URL = 'http://fiware-orion:1026/ngsi-ld/v1/entities';

  private lastSentTime: Map<string, number> = new Map();
  private readonly COOLDOWN_MS = 30 * 60 * 1000; 

  constructor(private readonly httpService: HttpService) {}

  onModuleInit() {
    try {
      // process.cwd() trong container thường là /app
      const serviceAccountPath = path.join(process.cwd(), 'apps/notification-service/firebase-admin-key.json');

      this.logger.log(`🔍 Đang tìm key tại: ${serviceAccountPath}`);

      if (!fs.existsSync(serviceAccountPath)) {
         throw new Error(`❌ File key KHÔNG TỒN TẠI tại: ${serviceAccountPath}`);
      }

      const rawData = fs.readFileSync(serviceAccountPath, 'utf-8');
      const serviceAccount = JSON.parse(rawData);

      if (!admin.apps.length) {
        admin.initializeApp({
          credential: admin.credential.cert(serviceAccount),
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
        this.httpService.get(this.ORION_URL, {
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
        this.logger.error(`❌ Không thể kết nối tới Orion tại ${this.ORION_URL}. Hãy kiểm tra tên Service trong Docker Compose.`);
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
    
    if (!admin.apps.length) {
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
      await admin.messaging().send({
          notification: message.notification as any,
          topic: message.topic,
      });

      this.logger.log(`🚀 Đã bắn thông báo FCM thành công tới topic 'general_alerts'`);
    } catch (error) {
      this.logger.error('❌ Lỗi khi bắn FCM:', error);
    }
  }

  async sendIncidentNotification(userId: string, status: string, description: string) {
    if (!admin.apps.length) return;

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
      await admin.messaging().send(message);
      this.logger.log(`🚀 Đã gửi FCM tới user_${userId}: ${status}`);
    } catch (error) {
      this.logger.error(`❌ Lỗi gửi FCM Incident:`, error);
    }
  }
}