import { IsEmail, IsNotEmpty, IsString, MinLength } from 'class-validator';

export class RegisterUserDto {
  @IsEmail({}, { message: 'Email phải đúng định dạng.' })
  @IsNotEmpty({ message: 'Email không được để trống.' })
  email: string;

  @IsString()
  @MinLength(8, { message: 'Mật khẩu phải có ít nhất 8 ký tự.' })
  @IsNotEmpty({ message: 'Mật khẩu không được để trống.' })
  password: string;

  @IsString()
  @IsNotEmpty({ message: 'Họ tên không được để trống.' })
  fullName: string;
}