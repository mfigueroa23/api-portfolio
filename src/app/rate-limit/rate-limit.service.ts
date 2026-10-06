import { Injectable } from '@nestjs/common';
import { PrismaService } from '../database/prisma.service.js';

export type RateLimitBucket = 'contact' | 'login' | 'testimonial';

const HOUR_MS = 60 * 60 * 1000;

// Hits allowed per IP within each bucket's rolling window.
const LIMITS: Record<RateLimitBucket, { maxHits: number; windowMs: number }> = {
  contact: { maxHits: 5, windowMs: HOUR_MS },
  login: { maxHits: 5, windowMs: HOUR_MS },
  testimonial: { maxHits: 3, windowMs: 24 * HOUR_MS },
};

// Sliding window stored in `rate_limit_hit` so counts survive restarts.
@Injectable()
export class RateLimitService {
  constructor(private readonly prisma: PrismaService) {}

  // Records a hit and returns true, or returns false without recording it when
  // the IP already has the bucket's maximum hits within its window.
  hit(bucket: RateLimitBucket, ip: string): Promise<boolean> {
    const { maxHits, windowMs } = LIMITS[bucket];
    const now = new Date();
    const windowStart = new Date(now.getTime() - windowMs);
    return this.prisma.$transaction(async (tx) => {
      await tx.rateLimitHit.deleteMany({
        where: { bucket, ip, createdAt: { lt: windowStart } },
      });
      const hits = await tx.rateLimitHit.count({ where: { bucket, ip } });
      if (hits >= maxHits) return false;
      // createdAt is set here (not by the database) so it uses the same clock
      // as windowStart.
      await tx.rateLimitHit.create({ data: { bucket, ip, createdAt: now } });
      return true;
    });
  }
}
