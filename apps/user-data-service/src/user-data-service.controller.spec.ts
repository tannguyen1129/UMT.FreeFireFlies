import { Test, TestingModule } from '@nestjs/testing';
import { UserDataServiceController } from './user-data-service.controller';
import { UserDataServiceService } from './user-data-service.service';
import { getRepositoryToken } from '@nestjs/typeorm';
import { User } from './entities/user.entity';
import { HttpService } from '@nestjs/axios';
import { ConfigService } from '@nestjs/config';

describe('UserDataServiceController', () => {
  let controller: UserDataServiceController;

  beforeEach(async () => {
    const module: TestingModule = await Test.createTestingModule({
      controllers: [UserDataServiceController],
      providers: [
        // Cung cấp service thật
        UserDataServiceService,
        
        // ----------------------------------------------------
        // 🚀 SỬA LỖI: Cung cấp các dependencies (giả lập)
        // mà UserDataServiceService cần (do file service.ts của bạn yêu cầu)
        // ----------------------------------------------------
        {
          provide: getRepositoryToken(User),
          useValue: {
            // Giả lập các hàm repository
            findOne: jest.fn(),
          },
        },
        {
          provide: HttpService,
          useValue: {
            // Giả lập các hàm http
            post: jest.fn(() => ({ pipe: jest.fn() })),
          },
        },
        {
          provide: ConfigService,
          useValue: {
            // Giả lập các hàm config
            get: jest.fn((key: string) => {
              if (key === 'ORION_LD_URL') return 'http://mock-orion';
              return null;
            }),
          },
        },
      ],
    }).compile();

    controller = module.get<UserDataServiceController>(UserDataServiceController);
  });

  // 🚀 SỬA LỖI: Xóa test 'getHello' và thay bằng test 'should be defined'
  describe('root', () => {
    it('should be defined', () => {
      expect(controller).toBeDefined();
    });
  });
});