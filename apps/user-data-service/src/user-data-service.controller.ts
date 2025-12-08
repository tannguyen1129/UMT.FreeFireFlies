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


import { Controller, Get, Post, Put, UseGuards, Req, Body, ValidationPipe } from '@nestjs/common';
import { UserDataServiceService } from './user-data-service.service';
import { AuthGuard } from '@nestjs/passport';
import type { Request } from 'express';
import { CreateSubscriptionDto } from './dto/create-subscription.dto'; 
import { UpdateUserDto } from './dto/update-user.dto';

@Controller('users')
export class UserDataServiceController {
  constructor(
    private readonly userDataServiceService: UserDataServiceService,
  ) {}

  @Put('me')
  @UseGuards(AuthGuard('jwt'))
  async updateProfile(
    @Req() req: Request,
    @Body(new ValidationPipe()) dto: UpdateUserDto,
  ) {
    const user = req.user as { userId: string };
    return this.userDataServiceService.updateProfile(user.userId, dto);
  }

  @Get('me')
  @UseGuards(AuthGuard('jwt'))
  async getProfile(@Req() req: Request) {

    const user = req.user as { userId: string; email: string };
    

    return this.userDataServiceService.getProfile(user.userId); 
  }

  @Post('add-points')
  @UseGuards(AuthGuard('jwt'))
  async addPoints(@Req() req: Request, @Body('points') points: number) {
    const user = req.user as { userId: string };
    return this.userDataServiceService.addGreenPoints(user.userId, points);
  }

  @Get('leaderboard')
  async getLeaderboard() {
    // Lấy Top 10 user có điểm cao nhất
    return this.userDataServiceService.getLeaderboard();
  }

  @Post('subscribe-aqi') 
  @UseGuards(AuthGuard('jwt'))
  async subscribeToAqiAlerts(
    @Req() req: Request,
    @Body(new ValidationPipe()) dto: CreateSubscriptionDto,
  ) {
    const user = req.user as { userId: string };
    return this.userDataServiceService.createAqiSubscription(user.userId, dto);
  }
}