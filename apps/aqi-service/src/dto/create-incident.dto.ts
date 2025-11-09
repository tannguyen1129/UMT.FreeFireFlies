import {
  IsNotEmpty,
  IsNumber,
  IsOptional,
  IsString,
  IsUrl,
  ValidateNested,
} from 'class-validator';
import { Type } from 'class-transformer'; 

class GeoJsonPoint {
  @IsString()
  @IsNotEmpty()
  type: 'Point';

  @IsNumber({}, { each: true })
  @IsNotEmpty()
  coordinates: [number, number]; 
}


export class CreateIncidentDto {
  @IsNumber()
  @IsNotEmpty()
  incident_type_id: number;

  @IsNotEmpty()
  @ValidateNested()
  @Type(() => GeoJsonPoint) 
  location: GeoJsonPoint;

  @IsString()
  @IsOptional()
  description: string;

  @IsString()
  @IsUrl()
  @IsOptional()
  image_url: string;
}