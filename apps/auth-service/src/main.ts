// apps/auth-service/src/main.ts
import { NestFactory } from '@nestjs/core';
import { AuthServiceModule } from './auth-service.module'; 
import * as dotenv from 'dotenv'; 

dotenv.config(); 

async function bootstrap() {
  const app = await NestFactory.create(AuthServiceModule);

  app.enableCors({ origin: '*' });

  const host = process.env.HOST || '0.0.0.0'; 
  const port = process.env.PORT_AUTH || 3003; 

  // NestJS listen(port, hostname)
  await app.listen(port, host); 
  
  console.log(`AuthService is running on: http://${host}:${port}`);
}
bootstrap();