import { MiddlewareConsumer, Module, NestModule, RequestMethod, Logger } from '@nestjs/common';
import { ConfigModule, ConfigService } from '@nestjs/config'; 
import { createProxyMiddleware, fixRequestBody } from 'http-proxy-middleware';

@Module({
  imports: [
    ConfigModule.forRoot({ 
      isGlobal: true,
    }),
  ],
  controllers: [],
  providers: [Logger],
})
export class ApiGatewayModule implements NestModule {
  
  constructor(
    private readonly configService: ConfigService,
    private readonly logger: Logger 
  ) {}

  configure(consumer: MiddlewareConsumer) {
    
    const authTarget = this.configService.get<string>('AUTH_SERVICE_URL');
    const userTarget = this.configService.get<string>('USER_SERVICE_URL');
    const aqiTarget = this.configService.get<string>('AQI_SERVICE_URL');

    // ✅ Proxy cho /auth (Giữ nguyên)
    consumer
      .apply(
        createProxyMiddleware({
          target: authTarget,
          changeOrigin: true,
          on: { proxyReq: fixRequestBody },
          proxyTimeout: 10000, 
        }),
      )
      .forRoutes({ path: '/auth/*path', method: RequestMethod.ALL });

    // ✅ Proxy cho /users (Giữ nguyên)
    consumer
      .apply(
        createProxyMiddleware({
          target: userTarget,
          changeOrigin: true,
          on: { proxyReq: fixRequestBody },
          proxyTimeout: 10000, 
        }),
      )
      .forRoutes({ path: '/users/*path', method: RequestMethod.ALL });

    // ✅ Proxy cho /aqi (ĐÃ SỬA)
    consumer
      .apply(
        createProxyMiddleware({
          target: aqiTarget, 
          changeOrigin: true,
          proxyTimeout: 130000,
          on: {
            proxyReq: (proxyReq, req, res) => {
              this.logger.log(`[GW-PROXY] Đang proxy request: ${req.method} ${req.url} -> ${aqiTarget}${proxyReq.path}`);
              
              // 🚀 FIX: XÓA 'res' KHỎI HÀM NÀY
              fixRequestBody(proxyReq, req);
            },
            proxyRes: (proxyRes, req, res) => {
              this.logger.log(`[GW-PROXY] Nhận phản hồi từ ${aqiTarget}: ${proxyRes.statusCode}`);
            },
            error: (err, req, res) => {
              this.logger.error(`[GW-PROXY] LỖI PROXY: ${err.message}`);
            },
            econnreset: (err, req, res) => {
              this.logger.error(`[GW-PROXY] LỖI ECONNRESET: ${err.message}`);
            },
          },
        }),
      )
      .forRoutes({ path: '/aqi/*path', method: RequestMethod.ALL });
  }
}