import { IsLatitude, IsLongitude, IsNotEmpty, IsOptional, IsNumber } from 'class-validator';
import { Type } from 'class-transformer';

export class GetGreenSpacesDto {
  @IsLatitude()
  @Type(() => Number) // Tự động chuyển string từ query sang number
  @IsNotEmpty()
  lat: number;

  @IsLongitude()
  @Type(() => Number)
  @IsNotEmpty()
  lng: number;

  @IsNumber()
  @Type(() => Number)
  @IsOptional() // Tùy chọn, nếu không có sẽ dùng 2000m
  radius: number; // Bán kính tìm kiếm (mét)
}