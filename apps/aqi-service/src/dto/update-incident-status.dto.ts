import { IsEnum, IsNotEmpty } from 'class-validator';

// Định nghĩa các trạng thái hợp lệ (dựa trên thiết kế)
export enum IncidentStatus {
  PENDING = 'pending',
  VERIFIED = 'verified',
  IN_PROGRESS = 'in_progress',
  RESOLVED = 'resolved',
  REJECTED = 'rejected',
}

export class UpdateIncidentStatusDto {
  @IsEnum(IncidentStatus) // Chỉ chấp nhận các giá trị trong enum
  @IsNotEmpty()
  status: IncidentStatus;
}