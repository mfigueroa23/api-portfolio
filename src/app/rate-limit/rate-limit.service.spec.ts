import { PrismaFake } from '../../../test/fakes/prisma.fake.js';
import { PrismaService } from '../database/prisma.service.js';
import { RateLimitService } from './rate-limit.service.js';

const MINUTE = 60 * 1000;

describe('RateLimitService', () => {
  let prisma: PrismaFake;
  let service: RateLimitService;

  beforeEach(() => {
    vi.useFakeTimers({ now: new Date('2026-10-01T12:00:00Z') });
    prisma = new PrismaFake();
    service = new RateLimitService(prisma as unknown as PrismaService);
  });

  afterEach(() => {
    vi.useRealTimers();
  });

  async function hitTimes(
    times: number,
    bucket: 'contact' | 'login',
    ip: string,
  ) {
    const results: boolean[] = [];
    for (let i = 0; i < times; i++) results.push(await service.hit(bucket, ip));
    return results;
  }

  it('allows 5 hits and rejects the 6th without storing it', async () => {
    expect(await hitTimes(6, 'contact', '1.1.1.1')).toEqual([
      true,
      true,
      true,
      true,
      true,
      false,
    ]);
    expect(await prisma.rateLimitHit.count()).toBe(5);
  });

  it('keeps rejecting until the oldest hit is older than 60 minutes', async () => {
    await hitTimes(5, 'contact', '1.1.1.1');

    vi.advanceTimersByTime(60 * MINUTE);
    expect(await service.hit('contact', '1.1.1.1')).toBe(false);

    vi.advanceTimersByTime(1);
    expect(await service.hit('contact', '1.1.1.1')).toBe(true);
  });

  it('frees one slot at a time as hits age out (sliding window)', async () => {
    await service.hit('contact', '1.1.1.1');
    vi.advanceTimersByTime(30 * MINUTE);
    await hitTimes(4, 'contact', '1.1.1.1');

    vi.advanceTimersByTime(30 * MINUTE + 1);
    expect(await hitTimes(2, 'contact', '1.1.1.1')).toEqual([true, false]);
  });

  it('counts buckets and IPs independently', async () => {
    await hitTimes(5, 'contact', '1.1.1.1');

    expect(await service.hit('login', '1.1.1.1')).toBe(true);
    expect(await service.hit('contact', '2.2.2.2')).toBe(true);
    expect(await service.hit('contact', '1.1.1.1')).toBe(false);
  });

  it('stores every hit through PrismaService so counts survive restarts', async () => {
    await hitTimes(5, 'login', '1.1.1.1');

    const restarted = new RateLimitService(prisma as unknown as PrismaService);
    expect(await restarted.hit('login', '1.1.1.1')).toBe(false);
  });
});
