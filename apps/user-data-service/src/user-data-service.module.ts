import { Module } from '@nestjs/common';
import { ConfigModule, ConfigService } from '@nestjs/config'; 
import { UserDataServiceController } from './user-data-service.controller';
import { UserDataServiceService } from './user-data-service.service';
import { TypeOrmModule } from '@nestjs/typeorm';
import { User } from './entities/user.entity';
import { Role } from './entities/role.entity';
import { PassportModule } from '@nestjs/passport';
import { JwtModule } from '@nestjs/jwt';
import { JwtStrategy } from './jwt.strategy';

@Module({
  imports: [
    ConfigModule.forRoot({
      isGlobal: true,
      // Dùng file .env gốc
    }),

  
    TypeOrmModule.forRootAsync({
      imports: [ConfigModule], // Cần import ConfigModule
      inject: [ConfigService],  // Tiêm ConfigService
      useFactory: (configService: ConfigService) => ({
        type: 'postgres',
        host: configService.get<string>('DB_HOST'),
        port: configService.get<number>('DB_PORT'), 
        username: configService.get<string>('DB_USER'),
        password: configService.get<string>('DB_PASS'), 
        database: configService.get<string>('DB_NAME'),
        entities: [User, Role], 
        synchronize: true,
        autoLoadEntities: true,
      }),
    }),

    TypeOrmModule.forFeature([User, Role]),

    // Cấu hình Passport (Giữ nguyên)
    PassportModule.register({ defaultStrategy: 'jwt' }),

    // 🚀 SỬA 2: DÙNG .registerAsync CHO JWT
    JwtModule.registerAsync({
      imports: [ConfigModule],
      inject: [ConfigService],
      useFactory: (configService: ConfigService) => ({
        secret: configService.get<string>('JWT_SECRET'), // 👈 Lấy an toàn
        signOptions: { expiresIn: '60m' },
      }),
    }),
  ],
  controllers: [UserDataServiceController],
  providers: [UserDataServiceService, JwtStrategy],
})
export class UserDataServiceModule {}