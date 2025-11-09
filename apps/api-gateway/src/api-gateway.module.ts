import { MiddlewareConsumer, Module, NestModule } from '@nestjs/common';
import { createProxyMiddleware, fixRequestBody } from 'http-proxy-middleware';

@Module({
  imports: [],
  controllers: [],
  providers: [],
})
export class ApiGatewayModule implements NestModule {
  configure(consumer: MiddlewareConsumer) {
    consumer
      .apply(
        createProxyMiddleware({
          target: 'http://localhost:3000', 
          changeOrigin: true,
          on: {
            proxyReq: fixRequestBody,
          },
        }),
      )
      .forRoutes('/auth/(.*)'); 
    consumer
      .apply(
        createProxyMiddleware({
          target: 'http://localhost:3001',
          changeOrigin: true,
          on: {
            proxyReq: fixRequestBody,
          },
        }),
      )
      .forRoutes('/users/(.*)'); 
    consumer
      .apply(
        createProxyMiddleware({
          target: 'http://localhost:3002', 
          changeOrigin: true,
          on: {
            proxyReq: fixRequestBody,
          },
        }),
      )
      .forRoutes('/incidents/(.*)'); 
  }
}