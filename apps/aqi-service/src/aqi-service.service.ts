import { Injectable } from '@nestjs/common';

@Injectable()
export class AqiServiceService {
  getHello(): string {
    return 'Hello World!';
  }
}
