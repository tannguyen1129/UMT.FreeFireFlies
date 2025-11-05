import { Module } from '@nestjs/common';
import { UserDataServiceController } from './user-data-service.controller';
import { UserDataServiceService } from './user-data-service.service';

@Module({
  imports: [],
  controllers: [UserDataServiceController],
  providers: [UserDataServiceService],
})
export class UserDataServiceModule {}
