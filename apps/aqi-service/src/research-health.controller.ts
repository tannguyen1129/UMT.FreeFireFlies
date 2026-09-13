import { Controller, Get, Res } from '@nestjs/common';
import type { Response } from 'express';
import { ResearchHealthService } from './research-health.service';

@Controller('internal/health')
export class ResearchHealthController {
  constructor(private readonly healthService: ResearchHealthService) {}

  @Get('research')
  async researchHealth(@Res({ passthrough: true }) response: Response) {
    const health = await this.healthService.inspect();
    response.status(health.status === 'ok' ? 200 : 503);
    return health;
  }
}
