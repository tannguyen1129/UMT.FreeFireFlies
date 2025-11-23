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