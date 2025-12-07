// apps/user-data-service/src/main.ts
import { NestFactory } from '@nestjs/core';
import { UserDataServiceModule } from './user-data-service.module';
import * as dotenv from 'dotenv'; 

dotenv.config(); 

async function bootstrap() {
  const app = await NestFactory.create(UserDataServiceModule);

  app.enableCors({ origin: '*' });

  const host = process.env.HOST || '0.0.0.0'; 
  
  // Dùng PORT hoặc mặc định 3001
  const port = process.env.PORT || 3001; 

  await app.listen(port, host); 
  
  console.log(`UserDataService is running on: http://${host}:${port}`);
}
bootstrap();