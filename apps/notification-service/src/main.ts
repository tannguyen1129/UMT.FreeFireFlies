import { NestFactory } from '@nestjs/core';
import { NotificationServiceModule } from './notification-service.module';
import { Logger } from '@nestjs/common';

async function bootstrap() {
  const app = await NestFactory.create(NotificationServiceModule);
  const globalPrefix = 'api';
  app.setGlobalPrefix(globalPrefix);
  const port = process.env.PORT || 3004; // Chạy cổng 3004

  // 🚀 BẮT BUỘC: Lắng nghe trên 0.0.0.0 để Docker gọi được
  await app.listen(port, '0.0.0.0'); 
  
  Logger.log(
    `🚀 Notification Service is running on: http://0.0.0.0:${port}/${globalPrefix}`
  );
}
bootstrap();