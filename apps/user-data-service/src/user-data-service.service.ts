import { Injectable } from '@nestjs/common';

@Injectable()
export class UserDataServiceService {
  getHello(): string {
    return 'Hello World!';
  }
}
