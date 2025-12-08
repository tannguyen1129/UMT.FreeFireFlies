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


import { IsLatitude, IsLongitude, IsNotEmpty } from 'class-validator';
import { Type } from 'class-transformer';

export class GetRecommendationDto {
  @IsLatitude()
  @Type(() => Number) // Tự động chuyển string từ query sang number
  @IsNotEmpty()
  startLat: number;

  @IsLongitude()
  @Type(() => Number)
  @IsNotEmpty()
  startLng: number;

  @IsLatitude()
  @Type(() => Number)
  @IsNotEmpty()
  endLat: number;

  @IsLongitude()
  @Type(() => Number)
  @IsNotEmpty()
  endLng: number;
}