// apps/aqi-service/src/main.ts
import { NestFactory } from '@nestjs/core';
import { AqiServiceModule } from './aqi-service.module';
import { json, urlencoded } from 'express';
import * as dotenv from 'dotenv'; // 👈 1. IMPORT dotenv

dotenv.config(); // 👈 2. GỌI dotenv.config() NGAY LẬP TỨC

async function bootstrap() {
  const app = await NestFactory.create(AqiServiceModule);

  app.use(json({ limit: '50mb' }));
  app.use(urlencoded({ limit: '50mb', extended: true }));
  app.enableCors({ origin: '*' });

  // 🚀 3. SỬA LẠI HÀM LISTEN
  // Đọc HOST và PORT từ process.env (đã được dotenv tải)
  const host = process.env.HOST || '127.0.0.1';
  const port = process.env.PORT_AQI || 3002; // Dùng PORT_AQI hoặc 3002

  await app.listen(port, host); // 👈 SỬA LẠI DÒNG NÀY
  
  console.log(`AqiService is running on: http://${host}:${port}`); // 👈 Sửa log
}
bootstrap();