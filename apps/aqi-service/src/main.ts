import { NestFactory } from '@nestjs/core';
import { AqiServiceModule } from './aqi-service.module';

async function bootstrap() {
  const app = await NestFactory.create(AqiServiceModule);
  app.enableCors({ origin: '*' });

  // 🚀 SỬA: Thêm '0.0.0.0'
  await app.listen(process.env.port ?? 3002, '0.0.0.0');
  console.log(`AqiService is running on: ${await app.getUrl()}`);
}
bootstrap();