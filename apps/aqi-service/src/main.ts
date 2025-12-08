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
import { AqiServiceModule } from './aqi-service.module';
import { NestExpressApplication } from '@nestjs/platform-express';
import { json, urlencoded } from 'express';
import { join } from 'path'; // 👈 1. BỔ SUNG IMPORT NÀY
import * as dotenv from 'dotenv';

dotenv.config();

async function bootstrap() {
  const app = await NestFactory.create<NestExpressApplication>(AqiServiceModule);

  // Cấu hình giới hạn dung lượng body (cho upload ảnh)
  app.use(json({ limit: '50mb' }));
  app.use(urlencoded({ limit: '50mb', extended: true }));
  
  // Cấu hình CORS
  app.enableCors({ origin: '*' });

  app.useStaticAssets(join(process.cwd(), 'uploads'), {
    prefix: '/uploads/',
  });

  const host = process.env.HOST || '0.0.0.0'; 
  const port = process.env.PORT_AQI || 3002;

  await app.listen(port, host);
  
  console.log(`🚀 AqiService is running on: http://${host}:${port}`);
  console.log(`📂 Static Assets serving at: http://${host}:${port}/uploads/`);
}
bootstrap();