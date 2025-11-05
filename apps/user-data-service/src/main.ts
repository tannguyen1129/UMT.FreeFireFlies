import { NestFactory } from '@nestjs/core';
import { UserDataServiceModule } from './user-data-service.module';

async function bootstrap() {
  const app = await NestFactory.create(UserDataServiceModule);
  await app.listen(process.env.port ?? 3000);
}
bootstrap();
