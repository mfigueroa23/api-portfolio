import { Injectable, Logger } from '@nestjs/common';
import { PrismaService } from '../database/prisma.service.js';

// Allowed CORS origins live in the `cors_origin` table and are read on every
// request, without a cache, so an SQL change applies immediately.
@Injectable()
export class CorsOriginsService {
  private readonly logger = new Logger(CorsOriginsService.name);

  constructor(private readonly prisma: PrismaService) {}

  async isAllowed(origin: string): Promise<boolean> {
    try {
      const row = await this.prisma.corsOrigin.findUnique({
        where: { origin },
      });
      return row?.enabled ?? false;
    } catch (error) {
      // Failing closed: without the table no origin gets CORS headers, but the
      // request itself is still served.
      this.logger.error(error);
      return false;
    }
  }
}
