import { NestFactory } from '@nestjs/core';
import { ResearchCollectorModule } from './research-collector.module';

async function bootstrap() {
  const app = await NestFactory.createApplicationContext(ResearchCollectorModule);
  app.enableShutdownHooks();
}

bootstrap();
