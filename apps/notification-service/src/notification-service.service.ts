import { Injectable, Logger, OnModuleInit } from '@nestjs/common';
import { Cron } from '@nestjs/schedule';
import { HttpService } from '@nestjs/axios';
import { firstValueFrom } from 'rxjs';
import * as admin from 'firebase-admin';
import * as fs from 'fs';

@Injectable()
export class NotificationServiceService implements OnModuleInit {
  private readonly logger = new Logger(NotificationServiceService.name);
  
  // URL của Orion-LD (Gọi localhost vì service này chạy trên Host)
  private readonly ORION_URL = 'http://localhost:1026/ngsi-ld/v1/entities';

  // Bộ nhớ đệm để tránh Spam (Cooldown 30 phút)
  private lastSentTime: Map<string, number> = new Map();
  private readonly COOLDOWN_MS = 30 * 60 * 1000; 

  constructor(private readonly httpService: HttpService) {}

  onModuleInit() {
    try {
      // Đường dẫn tuyệt đối đến file key Firebase
      const serviceAccountPath = '/root/open-source/green-aqi-navigator/apps/notification-service/firebase-admin-key.json';

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
      this.logger.error('❌ Lỗi khởi tạo Firebase:', error.message);
    }
  }

  // 🚀 CHẠY MỖI 1 PHÚT (POLLING)
  @Cron('*/1 * * * *') 
  async checkAirQualityAndNotify() {
    try {
      // 1. Chủ động gọi Orion-LD để lấy TẤT CẢ dự báo
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
        for (const entity of entities) {
          this.checkSingleStation(entity);
        }
      }

    } catch (error) {
      this.logger.error('❌ Lỗi khi tuần tra:', error.message);
    }
  }

  private checkSingleStation(data: any) {
    const pm25 = data.forecastedPM25?.value;
    const timeStr = data.validFrom?.value?.['@value'];
    const stationId = data.id; 
    
    if (!pm25 || !timeStr) return;

    // Lấy tên khu vực từ ID
    const districtName = stationId.split(':').pop().replace('OWM-', '');

    // Kiểm tra Cooldown (Chống spam)
    const lastTime = this.lastSentTime.get(districtName) || 0;
    const now = Date.now();
    
    // Nếu chưa đủ 30 phút -> Bỏ qua
    if (now - lastTime < this.COOLDOWN_MS) return;
    
    // Kiểm tra điều kiện (Ngưỡng > 40)
    if (pm25 > 40) {
      this.sendAlert(districtName, pm25, timeStr);
      this.lastSentTime.set(districtName, now); // Cập nhật giờ gửi
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
      this.logger.error('❌ Lỗi khi bắn FCM:', error.message);
    }
  }
}