import { Controller, Get, Req, UseGuards } from '@nestjs/common';
import { UserDataServiceService } from './user-data-service.service';
import { AuthGuard } from '@nestjs/passport';
import type { Request } from 'express';

@Controller('users') 
export class UserDataServiceController {
  constructor(private readonly userDataServiceService: UserDataServiceService) {}

  @Get('me') 
  @UseGuards(AuthGuard('jwt')) 
  async getProfile(@Req() req: Request) {
    const userPayload = req.user as { userId: string };

    return this.userDataServiceService.getProfile(userPayload.userId);
  }
}