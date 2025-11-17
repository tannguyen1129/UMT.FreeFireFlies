import { Injectable, Logger, NotFoundException } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { User } from './entities/user.entity';
import { Repository } from 'typeorm';
import { HttpService } from '@nestjs/axios';
import { ConfigService } from '@nestjs/config';
import { firstValueFrom } from 'rxjs';
import { CreateSubscriptionDto } from './dto/create-subscription.dto';

@Injectable()
export class UserDataServiceService {
  private readonly logger = new Logger(UserDataServiceService.name);

  // 🚀 SỬA 1: Khai báo biến
  private readonly orionLdSubscriptionsUrl: string;
  private readonly publicWebhookUrl: string;

  private readonly NGSI_LD_CONTEXT = '<https://smartdatamodels.org/context.jsonld>; rel="http://www.w3.org/ns/json-ld#context"; type="application/ld+json"';

  constructor(
    @InjectRepository(User)
    private readonly userRepository: Repository<User>,
    private readonly httpService: HttpService,
    private readonly configService: ConfigService,
  ) {
    // 🚀 SỬA 2: Lấy và Xử lý URL từ .env
    
    // Lấy ORION_LD_URL (ví dụ: http://.../v1/entities)
    const orionEntitiesUrl = this.configService.get<string>('ORION_LD_URL');
    if (!orionEntitiesUrl) {
      throw new Error('ORION_LD_URL is not defined in .env file');
    }
    // Tự động suy ra URL subscriptions (thay /entities bằng /subscriptions)
    this.orionLdSubscriptionsUrl = orionEntitiesUrl.replace('/entities', '/subscriptions');

    // Lấy URL công khai của API Gateway (bạn PHẢI thêm biến này vào .env)
    const gatewayPublicUrl = this.configService.get<string>('API_GATEWAY_PUBLIC_URL');
    if (!gatewayPublicUrl) {
      throw new Error('API_GATEWAY_PUBLIC_URL is not defined in .env file. (Ví dụ: http://<IP_HOST_CỦA_BẠN>:3000)');
    }
    
    // Webhook sẽ trỏ đến API Gateway, chứ KHÔNG trỏ trực tiếp đến aqi-service
    this.publicWebhookUrl = `${gatewayPublicUrl}/aqi/notify-user`;
    
    this.logger.log(`Orion-LD Subscriptions URL: ${this.orionLdSubscriptionsUrl}`);
    this.logger.log(`Public Webhook Receiver URL: ${this.publicWebhookUrl}`);
  }

  // ... (các hàm getProfile và findByEmail giữ nguyên) ...
  async getProfile(userId: string): Promise<Omit<User, 'password_hash'>> {
    const user = await this.userRepository.findOne({
      where: { user_id: userId },
      relations: ['roles'],
    });

    if (!user) {
      throw new NotFoundException('Không tìm thấy người dùng');
    }
    const { password_hash, ...result } = user;
    return result;
  }

  async findByEmail(email: string): Promise<User | null> {
    return this.userRepository.findOne({
      where: { email },
      relations: ['roles'],
    });
  }


  // ================================================================
  // LOGIC TẠO ĐĂNG KÝ (SUBSCRIPTION)
  // ================================================================
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
          // 🚀 SỬA 3: Sử dụng URL công khai đã được cấu hình
          uri: this.publicWebhookUrl,
          accept: 'application/json',
        },
      },
    };

    this.logger.log(`Đang POST Subscription lên ${this.orionLdSubscriptionsUrl}...`);
    try {
      await firstValueFrom(
        this.httpService.post(this.orionLdSubscriptionsUrl, subscriptionPayload, {
          headers: {
            'Content-Type': 'application/json',
            'Link': this.NGSI_LD_CONTEXT,
          },
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
}