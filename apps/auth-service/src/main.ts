// apps/auth-service/src/main.ts
import { NestFactory } from '@nestjs/core';
// Giả sử tên module của bạn là AuthServiceModule
import { AuthServiceModule } from './auth-service.module'; 
import * as dotenv from 'dotenv'; // 👈 1. IMPORT dotenv

dotenv.config(); // 👈 2. GỌI dotenv.config() NGAY LẬP TỨC

async function bootstrap() {
  const app = await NestFactory.create(AuthServiceModule);

  app.enableCors({ origin: '*' });

  // 🚀 3. SỬA LẠI HÀM LISTEN
  const host = process.env.HOST || '127.0.0.1';
  // Dùng PORT_AUTH (nếu có) hoặc 3003
  const port = process.env.PORT_AUTH || 3003; 

  await app.listen(port, host); // 👈 SỬA LẠI DÒNG NÀY
  
  console.log(`AuthService is running on: http://${host}:${port}`); // 👈 Sửa log
}
bootstrap();