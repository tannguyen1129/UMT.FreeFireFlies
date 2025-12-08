/*
 * Copyright 2025 Green-AQI Navigator Team
 *
 * Licensed under the Apache License, Version 2.0 (the "License");
 * you may not use this file except in compliance with the License.
 * You may obtain a copy of the License at
 *
 * http://www.apache.org/licenses/LICENSE-2.0
 *
 * Unless required by applicable law or agreed to in writing, software
 * distributed under the License is distributed on an "AS IS" BASIS,
 * WITHOUT WARRANTIES OR CONDITIONS OF ANY KIND, either express or implied.
 * See the License for the specific language governing permissions and
 * limitations under the License.
 */


import { Injectable, Logger, NotFoundException } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { User } from './entities/user.entity';
import { Repository } from 'typeorm';
import { HttpService } from '@nestjs/axios';
import { ConfigService } from '@nestjs/config';
import { firstValueFrom } from 'rxjs';
import { CreateSubscriptionDto } from './dto/create-subscription.dto';
import { UpdateUserDto } from './dto/update-user.dto';

@Injectable()
export class UserDataServiceService {
  private readonly logger = new Logger(UserDataServiceService.name);

  private readonly orionLdSubscriptionsUrl: string;
  
  // 🚀 SỬA QUAN TRỌNG: Trỏ thẳng vào Notification Service (Cổng 3004)
  // IP 172.17.0.1 là cầu nối để Docker (Orion) gọi ra ngoài Host (Service)
  private readonly webhookUrl = 'http://172.17.0.1:3004/api/notifications/webhook';

  private readonly NGSI_LD_CONTEXT = [
    "https://smartdatamodels.org/context.jsonld",
    "https://uri.etsi.org/ngsi-ld/v1/ngsi-ld-core-context-v1.7.jsonld"
  ];

  constructor(
    @InjectRepository(User)
    private readonly userRepository: Repository<User>,
    private readonly httpService: HttpService,
    private readonly configService: ConfigService,
  ) {
    const orionEntitiesUrl = this.configService.get<string>('ORION_LD_URL');
    if (!orionEntitiesUrl) {
      throw new Error('ORION_LD_URL is not defined in .env file');
    }
    this.orionLdSubscriptionsUrl = orionEntitiesUrl.replace('/entities', '/subscriptions');

    this.logger.log(`Orion-LD Subscriptions URL: ${this.orionLdSubscriptionsUrl}`);
    this.logger.log(`Webhook URL (Fixed): ${this.webhookUrl}`);
  }

  async getProfile(userId: string): Promise<Omit<User, 'password_hash'>> {
    const user = await this.userRepository.findOne({
      where: { user_id: userId },
      relations: ['roles'],
    });
    if (!user) throw new NotFoundException('Không tìm thấy người dùng');
    const { password_hash, ...result } = user;
    return result;
  }

  async findByEmail(email: string): Promise<User | null> {
    return this.userRepository.findOne({
      where: { email },
      relations: ['roles'],
    });
  }

  async createAqiSubscription(userId: string, dto: CreateSubscriptionDto) {
    this.logger.log(`User ${userId} yêu cầu đăng ký cảnh báo AQI...`);
    const threshold = dto.threshold || 50;

    const subscriptionPayload = {
      id: `urn:ngsi-ld:Subscription:User:${userId}:AQIAlert`,
      type: 'Subscription',
      description: `Đăng ký cảnh báo PM2.5 > ${threshold} cho người dùng ${userId}`,
      entities: [{ type: 'AirQualityForecast' }],
      watchedAttributes: ['forecastedPM25'],
      q: `forecastedPM25.value>${threshold}`,
      notification: {
        attributes: ['forecastedPM25', 'location', 'validFrom'],
        format: 'normalized',
        endpoint: {
          uri: this.webhookUrl, // 👈 Dùng URL cổng 3004
          accept: 'application/json',
        },
      },
      '@context': this.NGSI_LD_CONTEXT,
    };

    try {
      await firstValueFrom(
        this.httpService.post(this.orionLdSubscriptionsUrl, subscriptionPayload, {
          headers: { 'Content-Type': 'application/ld+json' },
          timeout: 5000,
        }),
      );
      this.logger.log(`✅ Đã tạo Subscription thành công cho user: ${userId}`);
      return { message: 'Đăng ký nhận cảnh báo thành công!' };

    } catch (error) {
      const status = error.response?.status;
      if (status === 409 || status === 422) {
        this.logger.warn(`Subscription cho user ${userId} đã tồn tại (Lỗi ${status}), bỏ qua.`);
        return { message: 'Bạn đã đăng ký nhận cảnh báo này rồi.' };
      }
      this.logger.error('Lỗi khi tạo Subscription trên Orion-LD', error.response?.data);
      throw new Error('Không thể tạo đăng ký với Context Broker');
    }
  }

  async updateProfile(userId: string, dto: UpdateUserDto): Promise<User> {
    const user = await this.userRepository.findOneBy({ user_id: userId });
    if (!user) throw new NotFoundException('User not found');

    if (dto.full_name) user.full_name = dto.full_name;
    if (dto.phone_number) user.phone_number = dto.phone_number;
    if (dto.agency_department) user.agency_department = dto.agency_department;
    
    // 🚀 THÊM DÒNG NÀY
    if (dto.health_group) user.health_group = dto.health_group;

    return this.userRepository.save(user);
  }

  async addGreenPoints(userId: string, points: number) {
    const user = await this.userRepository.findOneBy({ user_id: userId });
    if (user) {
      user.greenPoints = (user.greenPoints || 0) + points;
      await this.userRepository.save(user);
      return { currentPoints: user.greenPoints, added: points };
    }
  }

  async getLeaderboard(): Promise<User[]> {
    return this.userRepository.find({
      order: { greenPoints: 'DESC' },
      take: 10,
      select: ['full_name', 'greenPoints'], 
      loadEagerRelations: false, 
    });
  }

}