// apps/user-data-service/src/main.ts

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