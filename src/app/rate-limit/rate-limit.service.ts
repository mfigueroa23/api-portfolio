import { Injectable } from '@nestjs/common';
import { PrismaService } from '../database/prisma.service.js';

export type RateLimitBucket = 'contact' | 'login';

const MAX_HITS = 5;
const WINDOW_MS = 60 * 60 * 1000;

// Sliding window stored in `rate_limit_hit` so counts survive restarts.
@Injectable()
export class RateLimitService {
  constructor(private readonly prisma: PrismaService) {}

  // Records a hit and returns true, or returns false without recording it when
  // the IP already has MAX_HITS hits in the last WINDOW_MS for this bucket.
  hit(bucket: RateLimitBucket, ip: string): Promise<boolean> {
    const now = new Date();
    const windowStart = new Date(now.getTime() - WINDOW_MS);
    return this.prisma.$transaction(async (tx) => {
      await tx.rateLimitHit.deleteMany({
        where: { bucket, ip, createdAt: { lt: windowStart } },
      });
      const hits = await tx.rateLimitHit.count({ where: { bucket, ip } });
      if (hits >= MAX_HITS) return false;
      // createdAt is set here (not by the database) so it uses the same clock
      // as windowStart.
      await tx.rateLimitHit.create({ data: { bucket, ip, createdAt: now } });
      return true;
    });
  }
}
