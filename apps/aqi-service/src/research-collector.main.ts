import { NestFactory } from '@nestjs/core';
import { ResearchCollectorModule } from './research-collector.module';

async function bootstrap() {
  const app = await NestFactory.create(ResearchCollectorModule);
  app.enableShutdownHooks();
  const host = process.env.HEALTH_HOST || '0.0.0.0';
  const port = Number(process.env.HEALTH_PORT || 3002);
  await app.listen(port, host);
}

bootstrap();
