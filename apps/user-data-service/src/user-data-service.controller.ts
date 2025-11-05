import { Controller, Get } from '@nestjs/common';
import { UserDataServiceService } from './user-data-service.service';

@Controller()
export class UserDataServiceController {
  constructor(private readonly userDataServiceService: UserDataServiceService) {}

  @Get()
  getHello(): string {
    return this.userDataServiceService.getHello();
  }
}
