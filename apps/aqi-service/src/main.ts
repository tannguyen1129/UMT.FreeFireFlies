import { NestFactory } from '@nestjs/core';
import { AqiServiceModule } from './aqi-service.module';
import { NestExpressApplication } from '@nestjs/platform-express';
import { json, urlencoded } from 'express';
import { join } from 'path'; // 👈 1. BỔ SUNG IMPORT NÀY
import * as dotenv from 'dotenv';

dotenv.config();

async function bootstrap() {
  const app = await NestFactory.create<NestExpressApplication>(AqiServiceModule);

  // Cấu hình giới hạn dung lượng body (cho upload ảnh)
  app.use(json({ limit: '50mb' }));
  app.use(urlencoded({ limit: '50mb', extended: true }));
  
  // Cấu hình CORS
  app.enableCors({ origin: '*' });

  app.useStaticAssets(join(process.cwd(), 'uploads'), {
    prefix: '/uploads/',
  });

  const host = process.env.HOST || '0.0.0.0'; 
  const port = process.env.PORT_AQI || 3002;

  await app.listen(port, host);
  
  console.log(`🚀 AqiService is running on: http://${host}:${port}`);
  console.log(`📂 Static Assets serving at: http://${host}:${port}/uploads/`);
}
bootstrap();