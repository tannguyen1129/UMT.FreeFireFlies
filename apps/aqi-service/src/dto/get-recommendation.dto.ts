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