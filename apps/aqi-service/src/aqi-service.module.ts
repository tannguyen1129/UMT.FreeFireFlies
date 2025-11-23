import { Module } from '@nestjs/common';
import { ConfigModule, ConfigService } from '@nestjs/config'; 
import { HttpModule } from '@nestjs/axios';
import { AqiServiceController } from './aqi-service.controller';
import { AqiServiceService } from './aqi-service.service';
import { TypeOrmModule } from '@nestjs/typeorm';
import { ScheduleModule } from '@nestjs/schedule';

import { User } from './entities/user.entity';
import { Role } from './entities/role.entity';
import { IncidentType } from './entities/incident-type.entity';
import { Incident } from './entities/incident.entity';
import { PassportModule } from '@nestjs/passport';
import { JwtModule } from '@nestjs/jwt';
import { JwtStrategy } from './jwt.strategy';
import { RoutePlannerService } from './route-planner.service';
import { AirQualityObservation } from './entities/air-quality-observation.entity'; 
import { WeatherObservation } from './entities/weather-observation.entity';
import { UrbanGreenSpace } from './entities/urban-green-space.entity';
import { SensitiveArea } from './entities/sensitive-area.entity';
import { RoadFeature } from './entities/road-feature.entity';
import { PerceivedAirQuality } from './entities/perceived-air-quality.entity';

@Module({
  imports: [
    ConfigModule.forRoot({
      isGlobal: true,
      // Dùng file .env gốc
    }),
    HttpModule, // Giữ nguyên HttpModule cho việc gọi Orion-LD
    ScheduleModule.forRoot(),


    TypeOrmModule.forRootAsync({
      imports: [ConfigModule], // Cần import ConfigModule ở đây
      inject: [ConfigService], // Tiêm ConfigService
      useFactory: (configService: ConfigService) => ({
        type: 'postgres',
        host: configService.get<string>('DB_HOST'),
        port: configService.get<number>('DB_PORT'), 
        username: configService.get<string>('DB_USER'),
        password: configService.get<string>('DB_PASS'),
        database: configService.get<string>('DB_NAME'),
        entities: [User, Role, IncidentType, Incident, AirQualityObservation, WeatherObservation, UrbanGreenSpace, SensitiveArea, RoadFeature, PerceivedAirQuality], 
        synchronize: true,
        autoLoadEntities: true,
      }),
    }),

    // Đăng ký Entities cho Module 
    TypeOrmModule.forFeature([IncidentType, Incident, AirQualityObservation, WeatherObservation, UrbanGreenSpace, SensitiveArea, RoadFeature, PerceivedAirQuality]),

    // Cấu hình Passport 
    PassportModule.register({ defaultStrategy: 'jwt' }),

  
    JwtModule.registerAsync({
      imports: [ConfigModule],
      inject: [ConfigService],
      useFactory: (configService: ConfigService) => ({
        secret: configService.get<string>('JWT_SECRET'),
        signOptions: { expiresIn: '60m' },
      }),
    }),
  ],
  controllers: [AqiServiceController],
  providers: [AqiServiceService, JwtStrategy, RoutePlannerService],
})
export class AqiServiceModule {}