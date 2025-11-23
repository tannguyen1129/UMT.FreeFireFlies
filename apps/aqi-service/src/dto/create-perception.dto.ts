import { IsNotEmpty, IsNumber, Min, Max, IsLatitude, IsLongitude } from 'class-validator';
import { Type } from 'class-transformer';

export class CreatePerceptionDto {
  @IsNumber()
  @Min(1)
  @Max(4)
  feeling: number; // 1..4

  @IsLatitude()
  @Type(() => Number)
  @IsNotEmpty()
  latitude: number;

  @IsLongitude()
  @Type(() => Number)
  @IsNotEmpty()
  longitude: number;
}