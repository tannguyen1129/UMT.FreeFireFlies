import { Test, TestingModule } from '@nestjs/testing';
import { UserDataServiceController } from './user-data-service.controller';
import { UserDataServiceService } from './user-data-service.service';

describe('UserDataServiceController', () => {
  let userDataServiceController: UserDataServiceController;

  beforeEach(async () => {
    const app: TestingModule = await Test.createTestingModule({
      controllers: [UserDataServiceController],
      providers: [UserDataServiceService],
    }).compile();

    userDataServiceController = app.get<UserDataServiceController>(UserDataServiceController);
  });

  describe('root', () => {
    it('should return "Hello World!"', () => {
      expect(userDataServiceController.getHello()).toBe('Hello World!');
    });
  });
});
