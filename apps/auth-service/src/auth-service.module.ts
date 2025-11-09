import { Module } from '@nestjs/common';
import { AuthServiceController } from './auth-service.controller';
import { AuthServiceService } from './auth-service.service';
import { TypeOrmModule } from '@nestjs/typeorm';
import { User } from './entities/user.entity';
import { Role } from './entities/role.entity';
import { JwtModule } from '@nestjs/jwt';

@Module({
  imports: [
    TypeOrmModule.forRoot({
      type: 'postgres', 
      host: 'localhost', 
      port: 5432, 
      username: 'postgres', 
      password: '781640Tan', 
      database: 'green_aqi_db',
      entities: [], 
      synchronize: true, 
      autoLoadEntities: true,
    }),
    TypeOrmModule.forFeature([User, Role]),
    JwtModule.register({ 
      global: true, // Làm cho JwtModule có sẵn toàn cục
      secret: 'MY_SECRET_KEY', 
      signOptions: { expiresIn: '60m' }, // Token hết hạn sau 60 phút
    }),
  ],
  controllers: [AuthServiceController],
  providers: [AuthServiceService],
})
export class AuthServiceModule {}