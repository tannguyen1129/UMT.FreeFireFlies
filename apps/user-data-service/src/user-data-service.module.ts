import { Module } from '@nestjs/common';
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
    // 1. Cấu hình CSDL (giống hệt auth-service)
    TypeOrmModule.forRoot({
      type: 'postgres',
      host: 'localhost',
      port: 5432,
      username: 'postgres',
      password: '781640Tan', 
      database: 'green_aqi_db',
      entities: [User, Role],
      synchronize: true,
      autoLoadEntities: true,
    }),
    TypeOrmModule.forFeature([User, Role]), 

    // 2. Cấu hình Passport và JWT
    PassportModule.register({ defaultStrategy: 'jwt' }),
    JwtModule.register({
      secret: 'MY_SECRET_KEY', 
      signOptions: { expiresIn: '60m' },
    }),
  ],
  controllers: [UserDataServiceController],
  providers: [UserDataServiceService, JwtStrategy], 
})
export class UserDataServiceModule {}