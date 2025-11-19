import { Injectable, Logger, OnModuleInit } from '@nestjs/common';
import { Cron } from '@nestjs/schedule';
import { HttpService } from '@nestjs/axios';
import { firstValueFrom } from 'rxjs';
import * as admin from 'firebase-admin';
import * as fs from 'fs'; // 👈 QUAN TRỌNG: Import module File System

@Injectable()
export class NotificationServiceService implements OnModuleInit {
  private readonly logger = new Logger(NotificationServiceService.name);
  
  // URL gốc của Orion (để quét tất cả dự báo)
  private readonly ORION_URL = 'http://localhost:1026/ngsi-ld/v1/entities';

  // BỘ NHỚ ĐỆM CHỐNG SPAM (30 phút)
  private lastSentTime: Map<string, number> = new Map();
  private readonly COOLDOWN_MS = 30 * 60 * 1000; 

  constructor(private readonly httpService: HttpService) {}

  onModuleInit() {
    try {
      // FIX: Trỏ cứng vào đường dẫn tuyệt đối trên server
      const serviceAccountPath = '/root/open-source/green-aqi-navigator/apps/notification-service/firebase-admin-key.json';

      this.logger.log(`🔎 Loading Firebase key from: ${serviceAccountPath}`);
      
      // 1. Kiểm tra file có tồn tại không
      if (!fs.existsSync(serviceAccountPath)) {
          throw new Error(`❌ File key KHÔNG TỒN TẠI tại: ${serviceAccountPath}`);
      }

      // 2. Đọc file bằng fs (Thay vì require để tránh lỗi Webpack)
      const rawData = fs.readFileSync(serviceAccountPath, 'utf-8');
      const serviceAccount = JSON.parse(rawData);

      // 3. Khởi tạo Firebase (Kiểm tra xem đã init chưa để tránh lỗi duplicate)
      if (!admin.apps.length) {
        admin.initializeApp({
          credential: admin.credential.cert(serviceAccount),
        });
        this.logger.log('✅ Firebase Admin Initialized successfully');
      } else {
        this.logger.log('ℹ️ Firebase App already initialized');
      }

    } catch (error) {
      this.logger.error('❌ Lỗi khởi tạo Firebase:', error.message);
      // Không throw lỗi để App vẫn chạy tiếp các chức năng khác
    }
  }

  @Cron('*/1 * * * *') 
  async checkAirQualityAndNotify() {
    // ... (Hàm này giữ nguyên logic Polling)
    try {
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

    // Xử lý lấy tên quận từ ID (VD: urn:ngsi-ld:AirQualityForecast:Hanoi:Winter:2025:OWM-TayHo -> TayHo)
    // Lưu ý: Logic split này tuỳ thuộc vào format ID thực tế của bạn
    const districtName = stationId.split(':').pop().replace('OWM-', '');

    // Kiểm tra Cooldown
    const lastTime = this.lastSentTime.get(districtName) || 0;
    const now = Date.now();
    if (now - lastTime < this.COOLDOWN_MS) return;
    
    if (pm25 > 40) {
      this.sendAlert(districtName, pm25, timeStr);
      this.lastSentTime.set(districtName, now); // Cập nhật giờ gửi
    }
  }

  private async sendAlert(location: string, pm25: number, time: string) {
    this.logger.warn(`🔔 --- PHÁT HIỆN KHÔNG KHÍ XẤU TẠI ${location.toUpperCase()} ---`);
    
    // Kiểm tra nếu Firebase chưa init thì không gửi được
    if (!admin.apps.length) {
      this.logger.error('⚠️ Bỏ qua gửi thông báo vì Firebase chưa khởi tạo thành công.');
      return;
    }

    const message = {
      notification: {
        title: '⚠️ Cảnh báo Chất lượng Không khí!',
        body: `Khu vực ${location} đang có chỉ số PM2.5 cao (${pm25} µg/m³). Hãy đeo khẩu trang!`,
      },
      topic: 'general_alerts', // Gửi cho tất cả máy đã đăng ký topic này
    };

    try {
      // 🚀 GỬI MESSAGE QUA FCM
      await admin.messaging().send({
          notification: message.notification as any, // Cast type nếu cần thiết
          topic: message.topic,
      });

      this.logger.log(`🚀 Đã bắn thông báo FCM thành công tới topic 'general_alerts'`);
    } catch (error) {
      this.logger.error('❌ Lỗi khi bắn FCM:', error.message);
    }
  }
}