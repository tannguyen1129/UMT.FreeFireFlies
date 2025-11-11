import { Controller, Post, Body, ValidationPipe } from '@nestjs/common';
import { AuthServiceService } from './auth-service.service';
import { RegisterUserDto } from './dto/register-user.dto';
import { User } from './entities/user.entity';
import { LoginUserDto } from './dto/login-user.dto';

@Controller('auth') 
export class AuthServiceController {
  constructor(private readonly authServiceService: AuthServiceService) {}

  @Post('register')
  async register(
    @Body(new ValidationPipe()) registerDto: RegisterUserDto,
  ): Promise<Omit<User, 'password_hash'>> {
    return this.authServiceService.register(registerDto);
  }

  @Post('login') 
  async login(@Body(new ValidationPipe()) loginDto: LoginUserDto) {
    return this.authServiceService.login(loginDto);
  }
}