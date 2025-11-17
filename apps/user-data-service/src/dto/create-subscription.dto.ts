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