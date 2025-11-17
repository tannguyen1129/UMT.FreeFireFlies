// apps/user-service/src/main.ts
import { NestFactory } from '@nestjs/core';
import { UserDataServiceModule } from './user-data-service.module';
import * as dotenv from 'dotenv'; // 👈 1. IMPORT dotenv

dotenv.config(); // 👈 2. GỌI dotenv.config()

async function bootstrap() {
  const app = await NestFactory.create(UserDataServiceModule);

  app.enableCors({ origin: '*' });

  // 🚀 3. SỬA LẠI HÀM LISTEN
  const host = process.env.HOST || '127.0.0.1';
  const port = process.env.PORT_USER || 3001; // Dùng PORT_USER hoặc 3001

  await app.listen(port, host); // 👈 SỬA LẠI DÒNG NÀY
  
  console.log(`UserDataService is running on: http://${host}:${port}`); // 👈 Sửa log
}
bootstrap();