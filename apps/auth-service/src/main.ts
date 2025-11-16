import { NestFactory } from '@nestjs/core';
import { AuthServiceModule } from './auth-service.module';

async function bootstrap() {
  const app = await NestFactory.create(AuthServiceModule);
  app.enableCors({ origin: '*' });
  
  // 🚀 SỬA: Thêm '0.0.0.0' để lắng nghe trên IP của WSL
  await app.listen(process.env.PORT ?? 3003, '0.0.0.0'); 
  console.log(`AuthService is running on: ${await app.getUrl()}`);
}
bootstrap();