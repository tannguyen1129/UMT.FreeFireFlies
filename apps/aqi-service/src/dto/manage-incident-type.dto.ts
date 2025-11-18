import { IsNotEmpty, IsString, MaxLength, IsOptional } from 'class-validator';

export class ManageIncidentTypeDto {
  @IsString()
  @IsNotEmpty()
  @MaxLength(100)
  type_name: string;

  @IsString()
  @IsOptional()
  @MaxLength(255)
  description?: string;
}