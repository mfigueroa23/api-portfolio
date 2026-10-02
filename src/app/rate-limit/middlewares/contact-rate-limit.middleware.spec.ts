import { HttpException } from '@nestjs/common';
import type { Request, Response } from 'express';
import { RateLimitService } from '../rate-limit.service.js';
import { ContactRateLimitMiddleware } from './contact-rate-limit.middleware.js';

describe('ContactRateLimitMiddleware', () => {
  const hit = vi.fn();
  const middleware = new ContactRateLimitMiddleware({
    hit,
  } as unknown as RateLimitService);
  const req = {
    headers: { 'cf-connecting-ip': '203.0.113.7' },
    ip: '10.0.0.5',
  } as unknown as Request;
  const res = {} as Response;

  beforeEach(() => {
    hit.mockReset();
  });

  it('counts the hit for the real client IP and continues when allowed', async () => {
    hit.mockResolvedValue(true);
    const next = vi.fn();

    await middleware.use(req, res, next);

    expect(hit).toHaveBeenCalledWith('contact', '203.0.113.7');
    expect(next).toHaveBeenCalledTimes(1);
  });

  it('throws 429 with the spec message and stops when the limit is hit', async () => {
    hit.mockResolvedValue(false);
    const next = vi.fn();

    const error = await middleware.use(req, res, next).catch((e: unknown) => e);

    expect(error).toBeInstanceOf(HttpException);
    expect((error as HttpException).getStatus()).toBe(429);
    expect((error as HttpException).message).toBe(
      'Too many messages. Please try again later.',
    );
    expect(next).not.toHaveBeenCalled();
  });
});
