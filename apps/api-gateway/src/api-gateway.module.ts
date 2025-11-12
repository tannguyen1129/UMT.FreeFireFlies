import { MiddlewareConsumer, Module, NestModule, RequestMethod } from '@nestjs/common';
import { ConfigModule, ConfigService } from '@nestjs/config'; 
import { createProxyMiddleware, fixRequestBody } from 'http-proxy-middleware';

@Module({
  imports: [
    ConfigModule.forRoot({ 
      isGlobal: true,
      // Dùng file .env gốc
    }),
  ],
  controllers: [],
  providers: [],
})
export class ApiGatewayModule implements NestModule {
  

  constructor(private readonly configService: ConfigService) {}

  configure(consumer: MiddlewareConsumer) {

    const authUrl = this.configService.get<string>('AUTH_SERVICE_URL');
    const userUrl = this.configService.get<string>('USER_SERVICE_URL');
    const aqiUrl = this.configService.get<string>('AQI_SERVICE_URL');


    consumer
      .apply(
        createProxyMiddleware({
          target: authUrl, 
          changeOrigin: true,
          on: { proxyReq: fixRequestBody },
        }),
      )
      .forRoutes({ path: '/auth/*path', method: RequestMethod.ALL });

    // ✅ Proxy cho /users
    consumer
      .apply(
        createProxyMiddleware({
          target: userUrl, 
          changeOrigin: true,
          on: { proxyReq: fixRequestBody },
        }),
      )
      .forRoutes({ path: '/users/*path', method: RequestMethod.ALL });

    // ✅ Proxy cho /incidents
    consumer
      .apply(
        createProxyMiddleware({
          target: this.configService.get<string>('AQI_SERVICE_URL'), // Cổng 3002
          changeOrigin: true,
          proxyTimeout: 10000,
          on: { proxyReq: fixRequestBody },
        }),
      )
      .forRoutes({ path: '/aqi/*path', method: RequestMethod.ALL });
  }
}