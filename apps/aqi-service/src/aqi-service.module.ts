import { Module } from '@nestjs/common';
import { HttpModule } from '@nestjs/axios';
import { AqiServiceController } from './aqi-service.controller';
import { AqiServiceService } from './aqi-service.service';
import { TypeOrmModule } from '@nestjs/typeorm';
import { User } from './entities/user.entity'; 
import { Role } from './entities/role.entity'; 
import { IncidentType } from './entities/incident-type.entity'; 
import { Incident } from './entities/incident.entity';
import { PassportModule } from '@nestjs/passport'; 
import { JwtModule } from '@nestjs/jwt'; 
import { JwtStrategy } from './jwt.strategy'; 

@Module({
  imports: [
    // 1. Cấu hình CSDL
    HttpModule,
    TypeOrmModule.forRoot({
      type: 'postgres',
      host: 'localhost',
      port: 5432,
      username: 'postgres',
      password: '781640Tan', 
      database: 'green_aqi_db',
      entities: [User, Role, IncidentType, Incident], 
      synchronize: true, 
      autoLoadEntities: true,
    }),
    // 2. Đăng ký Entities cho Module
    TypeOrmModule.forFeature([IncidentType, Incident]),
    PassportModule.register({ defaultStrategy: 'jwt' }),
    JwtModule.register({
      secret: 'MY_SECRET_KEY', 
      signOptions: { expiresIn: '60m' },
    }),
  ],
  controllers: [AqiServiceController],
  providers: [AqiServiceService, JwtStrategy],
})
export class AqiServiceModule {}