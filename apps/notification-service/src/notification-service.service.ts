import { Injectable, Logger } from '@nestjs/common';
import { Cron, CronExpression } from '@nestjs/schedule';
import { HttpService } from '@nestjs/axios';
import { firstValueFrom } from 'rxjs';

@Injectable()
export class NotificationServiceService {
  private readonly logger = new Logger(NotificationServiceService.name);
  
  // Gọi vào gốc /entities để quét tất cả
  private readonly ORION_URL = 'http://localhost:1026/ngsi-ld/v1/entities';

  constructor(private readonly httpService: HttpService) {}

  @Cron('*/1 * * * *') 
  async checkAirQualityAndNotify() {
    try {
      // 1. Gọi Orion-LD
      const response = await firstValueFrom(
        this.httpService.get(this.ORION_URL, {
          params: {
            type: 'AirQualityForecast', 
            limit: 100
          },
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
    
    // 🚀 LOGIC MỚI: KIỂM TRA THỜI GIAN
    if (!timeStr) return;

    const forecastTime = new Date(timeStr);
    const now = new Date();
    
    // Chỉ cảnh báo nếu dự báo là cho tương lai gần (trong vòng 1 tiếng tới)
    // Hoặc quá khứ gần (không quá 30 phút trước)
    const diffMinutes = (forecastTime.getTime() - now.getTime()) / (1000 * 60);

    // Nếu dữ liệu quá cũ (> 30 phút trước) hoặc quá xa (> 60 phút tới), bỏ qua
    if (diffMinutes < -30 || diffMinutes > 60) {
        return; 
    }

    const districtName = stationId.split(':').pop().replace('OWM-', '');

    // 3. Kiểm tra điều kiện (Ngưỡng > 40)
    if (pm25 > 40) {
      this.sendAlert(districtName, pm25, timeStr);
    }
  }

  private sendAlert(location: string, pm25: number, time: string) {
    this.logger.warn(`🔔 --- CẢNH BÁO THỰC TẾ: KHÔNG KHÍ XẤU TẠI ${location.toUpperCase()} ---`);
    this.logger.log(`📍 Khu vực: ${location}`);
    this.logger.log(`🌫️ PM2.5 Dự báo: ${pm25} µg/m³`);
    this.logger.log(`⏰ Thời gian: ${time}`);
    this.logger.warn('---------------------------------------------');
    
    // TODO: Gọi Firebase
  }
}