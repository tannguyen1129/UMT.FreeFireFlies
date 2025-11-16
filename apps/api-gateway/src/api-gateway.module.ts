import { MiddlewareConsumer, Module, NestModule, RequestMethod, Logger } from '@nestjs/common';
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
  providers: [Logger], // 👈 Cung cấp Logger
})
export class ApiGatewayModule implements NestModule {
  
  // 🚀 Tiêm (Inject) ConfigService và Logger
  constructor(
    private readonly configService: ConfigService,
    private readonly logger: Logger 
  ) {}

  configure(consumer: MiddlewareConsumer) {
    
    // 🚀 GIẢI PHÁP DỨT ĐIỂM LỖI 504:
    // Gateway (trong WSL) phải gọi IP TĨNH của WSL (172.27.144.1)
    // thay vì 'localhost'
    const wslHostIp = '172.27.144.1'; // 👈 IP WSL (từ ipconfig)
    
    // Đọc cổng từ .env (ví dụ: http://localhost:3003 -> 3003)
    const authPort = this.configService.get<string>('AUTH_SERVICE_URL')?.split(':').pop() || '3003';
    const userPort = this.configService.get<string>('USER_SERVICE_URL')?.split(':').pop() || '3001';
    const aqiPort = this.configService.get<string>('AQI_SERVICE_URL')?.split(':').pop() || '3002';

    // Xác định target bằng IP tĩnh
    const authTarget = `http://${wslHostIp}:${authPort}`; // http://172.27.144.1:3003
    const userTarget = `http://${wslHostIp}:${userPort}`; // http://172.27.144.1:3001
    const aqiTarget = `http://${wslHostIp}:${aqiPort}`;  // http://172.27.144.1:3002

    // ✅ Proxy cho /auth
    consumer
      .apply(
        createProxyMiddleware({
          target: authTarget, // 👈 SỬA: Dùng IP thật
          changeOrigin: true,
          on: { proxyReq: fixRequestBody },
          proxyTimeout: 10000, // 10 giây
        }),
      )
      .forRoutes({ path: '/auth/*path', method: RequestMethod.ALL }); // 👈 SỬA: Dùng /*path

    // ✅ Proxy cho /users
    consumer
      .apply(
        createProxyMiddleware({
          target: userTarget, // 👈 SỬA: Dùng IP thật
          changeOrigin: true,
          on: { proxyReq: fixRequestBody },
          proxyTimeout: 10000, // 10 giây
        }),
      )
      .forRoutes({ path: '/users/*path', method: RequestMethod.ALL }); // 👈 SỬA: Dùng /*path

    // ✅ Proxy cho /aqi
    consumer
      .apply(
        createProxyMiddleware({
          target: aqiTarget, // 👈 SỬA: Dùng IP thật
          changeOrigin: true,
          proxyTimeout: 130000, // 130 giây (cho Overpass và ORS)
          on: {
            proxyReq: (proxyReq, req, res) => {
              // 🚀 SỬA: Dùng req.url
              this.logger.log(`[GW-PROXY] Đang proxy request: ${req.method} ${req.url} -> ${aqiTarget}${proxyReq.path}`);
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
      .forRoutes({ path: '/aqi/*path', method: RequestMethod.ALL }); // 👈 SỬA: Dùng /*path
  }
}