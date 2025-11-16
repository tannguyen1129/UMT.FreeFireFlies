import { NestFactory } from '@nestjs/core';
import { UserDataServiceModule } from './user-data-service.module';

async function bootstrap() {
  const app = await NestFactory.create(UserDataServiceModule);
  app.enableCors({ origin: '*' });

  // 🚀 SỬA: Thêm '0.0.0.0'
  await app.listen(3001, '0.0.0.0'); 
  console.log(`UserDataService is running on: ${await app.getUrl()}`);
}
bootstrap();