import { NestFactory } from '@nestjs/core';
import { ApiGatewayModule } from './api-gateway.module';

async function bootstrap() {
  const app = await NestFactory.create(ApiGatewayModule);

  // 🚀 BẬT CORS
  app.enableCors({
    origin: '*', // Cho phép tất cả (chỉ dùng khi dev)
  });

  await app.listen(3000, '0.0.0.0');
}
bootstrap();