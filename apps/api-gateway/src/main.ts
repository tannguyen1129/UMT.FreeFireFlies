// apps/api-gateway/src/main.ts

import { NestFactory } from '@nestjs/core';
import { ApiGatewayModule } from './api-gateway.module';
import { json, urlencoded } from 'express'; // 👈 1. IMPORT THÊM

async function bootstrap() {
  const app = await NestFactory.create(ApiGatewayModule);

  // 🚀 TĂNG GIỚI HẠN BODY
  app.use(json({ limit: '50mb' })); // 👈 2. THÊM VÀO
  app.use(urlencoded({ limit: '50mb', extended: true })); // 👈 3. THÊM VÀO

  // 🚀 BẬT CORS
  app.enableCors({
    origin: '*', // Cho phép tất cả (chỉ dùng khi dev)
  });

  await app.listen(3000, '0.0.0.0');
}
bootstrap();