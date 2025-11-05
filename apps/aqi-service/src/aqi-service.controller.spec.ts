import { Test, TestingModule } from '@nestjs/testing';
import { AqiServiceController } from './aqi-service.controller';
import { AqiServiceService } from './aqi-service.service';

describe('AqiServiceController', () => {
  let aqiServiceController: AqiServiceController;

  beforeEach(async () => {
    const app: TestingModule = await Test.createTestingModule({
      controllers: [AqiServiceController],
      providers: [AqiServiceService],
    }).compile();

    aqiServiceController = app.get<AqiServiceController>(AqiServiceController);
  });

  describe('root', () => {
    it('should return "Hello World!"', () => {
      expect(aqiServiceController.getHello()).toBe('Hello World!');
    });
  });
});
