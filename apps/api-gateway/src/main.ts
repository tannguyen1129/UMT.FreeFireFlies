// apps/api-gateway/src/main.ts
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
import { ApiGatewayModule } from './api-gateway.module';
import { json, urlencoded } from 'express'; // 👈 1. IMPORT THÊM

async function bootstrap() {
  const app = await NestFactory.create(ApiGatewayModule);

  // 🚀 TĂNG GIỚI HẠN BODY
  app.use(json({ limit: '50mb' })); // 👈 2. THÊM VÀO
  app.use(urlencoded({ limit: '50mb', extended: true })); // 👈 3. THÊM VÀO

  app.enableCors({
    origin: true, 
    methods: 'GET,HEAD,PUT,PATCH,POST,DELETE,OPTIONS',
    credentials: true,
  })

  await app.listen(3000, '0.0.0.0');
}
bootstrap();