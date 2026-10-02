import { Controller, Get } from '@nestjs/common';

// Liveness endpoint used by the Dockerfile HEALTHCHECK.
@Controller()
export class HealthController {
  @Get()
  check(): { status: string } {
    return { status: 'ok' };
  }
}
