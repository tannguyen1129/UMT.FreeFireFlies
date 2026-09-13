import { Module } from '@nestjs/common';
import { HttpModule } from '@nestjs/axios';
import { ConfigModule, ConfigService } from '@nestjs/config';
import { TypeOrmModule } from '@nestjs/typeorm';
import { AQGridPoint } from './entities/aq-grid-point.entity';
import { AirQualityObservation } from './entities/air-quality-observation.entity';
import { WeatherObservation } from './entities/weather-observation.entity';
import { ResearchCollectorService } from './research-collector.service';
import { ResearchHealthController } from './research-health.controller';
import { ResearchHealthService } from './research-health.service';

@Module({
  imports: [
    ConfigModule.forRoot({ isGlobal: true }),
    HttpModule,
    TypeOrmModule.forRootAsync({
      imports: [ConfigModule],
      inject: [ConfigService],
      useFactory: (configService: ConfigService) => ({
        type: 'postgres',
        host: configService.get<string>('DB_HOST'),
        port: configService.get<number>('DB_PORT', 5432),
        username: configService.get<string>('DB_USER'),
        password: configService.get<string>('DB_PASS'),
        database: configService.get<string>('DB_NAME'),
        entities: [AQGridPoint, AirQualityObservation, WeatherObservation],
        synchronize: false,
        autoLoadEntities: true,
      }),
    }),
    TypeOrmModule.forFeature([
      AQGridPoint,
      AirQualityObservation,
      WeatherObservation,
    ]),
  ],
  controllers: [ResearchHealthController],
  providers: [ResearchCollectorService, ResearchHealthService],
})
export class ResearchCollectorModule {}
