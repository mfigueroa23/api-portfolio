import {
  HttpException,
  HttpStatus,
  Injectable,
  NestMiddleware,
} from '@nestjs/common';
import type { NextFunction, Request, Response } from 'express';
import { clientIp } from '../../common/utils/client-ip.js';
import { TESTIMONIAL_LIMIT_MESSAGE } from '../../content/testimonials/testimonials.constants.js';
import { RateLimitService } from '../rate-limit.service.js';

// Runs before JsonBodyMiddleware, so every submission is counted whatever its
// body turns out to be (valid, invalid, malformed or a honeypot discard), and
// the limit is checked before the honeypot and validation.
@Injectable()
export class TestimonialRateLimitMiddleware implements NestMiddleware {
  constructor(private readonly rateLimit: RateLimitService) {}

  async use(req: Request, _res: Response, next: NextFunction): Promise<void> {
    if (!(await this.rateLimit.hit('testimonial', clientIp(req)))) {
      throw new HttpException(
        TESTIMONIAL_LIMIT_MESSAGE,
        HttpStatus.TOO_MANY_REQUESTS,
      );
    }
    next();
  }
}
