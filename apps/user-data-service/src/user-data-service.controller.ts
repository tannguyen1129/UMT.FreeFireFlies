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