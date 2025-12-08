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


import { 
  IsOptional, 
  IsString, 
  MaxLength, 
  IsPhoneNumber,
  IsIn
} from 'class-validator';

export class UpdateUserDto {
  @IsOptional()
  @IsString()
  @MaxLength(100)
  full_name?: string;

  @IsOptional()
  @IsString()
  @IsPhoneNumber('VN') // Có thể bật nếu muốn validate chặt chẽ
  phone_number?: string;

  @IsOptional()
  @IsString()
  @MaxLength(255)
  agency_department?: string; // Cơ quan/Đơn vị

  @IsOptional()
  @IsString()
  @IsIn(['normal', 'sensitive', 'respiratory', 'athlete']) // Validate giá trị hợp lệ
  health_group?: string;
}