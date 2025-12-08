// apps/auth-service/src/main.ts
/*
 * Copyright 2025 Green-AQI Navigator Team
 *
 * Licensed under the Apache License, Version 2.0 (the "License");
 * you may not use this file except in compliance with the License.
 * You may obtain a copy of the License at
 *
 * http://www.apache.org/licenses/LICENSE-2.0
 *
 * Unless required by applicable law or agreed to in writing, software
 * distributed under the License is distributed on an "AS IS" BASIS,
 * WITHOUT WARRANTIES OR CONDITIONS OF ANY KIND, either express or implied.
 * See the License for the specific language governing permissions and
 * limitations under the License.
 */


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