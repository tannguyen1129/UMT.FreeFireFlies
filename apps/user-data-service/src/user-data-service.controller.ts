import { Controller, Get, Post, UseGuards, Req, Body, ValidationPipe } from '@nestjs/common'; 
import { UserDataServiceService } from './user-data-service.service';
import { AuthGuard } from '@nestjs/passport';
import type { Request } from 'express';
import { CreateSubscriptionDto } from './dto/create-subscription.dto'; 

@Controller('users')
export class UserDataServiceController {
  constructor(
    private readonly userDataServiceService: UserDataServiceService,
  ) {}

  @Get('me')
  @UseGuards(AuthGuard('jwt'))
  async getProfile(@Req() req: Request) {

    const user = req.user as { userId: string; email: string };
    

    return this.userDataServiceService.getProfile(user.userId); 
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