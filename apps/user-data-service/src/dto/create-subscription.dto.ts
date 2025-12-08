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


import { IsLatitude, IsLongitude, IsNotEmpty, IsOptional, IsNumber, Min } from 'class-validator';
import { Type } from 'class-transformer';

export class CreateSubscriptionDto {
  @IsLatitude()
  @Type(() => Number)
  @IsNotEmpty()
  lat: number;

  @IsLongitude()
  @Type(() => Number)
  @IsNotEmpty()
  lng: number;

  @IsNumber()
  @Type(() => Number)
  @Min(10) // Ngưỡng PM2.5 tối thiểu
  @IsOptional()
  threshold?: number; // Ngưỡng PM2.5, ví dụ: 50
}