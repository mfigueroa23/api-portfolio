import {
  HttpException,
  HttpStatus,
  Injectable,
  NestMiddleware,
} from '@nestjs/common';
import type { NextFunction, Request, Response } from 'express';
import { clientIp } from '../../common/utils/client-ip.js';
import { RateLimitService } from '../rate-limit.service.js';

// Runs before JsonBodyMiddleware, so every request is counted whatever its
// body turns out to be (valid, invalid, malformed or a honeypot discard).
@Injectable()
export class ContactRateLimitMiddleware implements NestMiddleware {
  constructor(private readonly rateLimit: RateLimitService) {}

  async use(req: Request, _res: Response, next: NextFunction): Promise<void> {
    if (!(await this.rateLimit.hit('contact', clientIp(req)))) {
      throw new HttpException(
        'Too many messages. Please try again later.',
        HttpStatus.TOO_MANY_REQUESTS,
      );
    }
    next();
  }
}
