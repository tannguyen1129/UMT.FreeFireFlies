/*
 * Copyright 2025 Green-AQI Navigator Team
 *
 * Licensed under the Apache License, Version 2.0 (the "License");
 * you may not use this file except in compliance with the License.
 * You may obtain a copy of the License at
 *
 * http://www.apache.org/licenses/LICENSE-2.0
 *
 * Unless required by applicable law or agreed to in writing, software
 * distributed under the License is distributed on an "AS IS" BASIS,
 * WITHOUT WARRANTIES OR CONDITIONS OF ANY KIND, either express or implied.
 * See the License for the specific language governing permissions and
 * limitations under the License.
 */


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