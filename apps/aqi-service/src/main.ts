import { NestFactory } from '@nestjs/core';
import { AqiServiceModule } from './aqi-service.module';

async function bootstrap() {
  const app = await NestFactory.create(AqiServiceModule);
  await app.listen(process.env.port ?? 3000);
}
bootstrap();
