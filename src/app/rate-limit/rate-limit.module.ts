import { Module } from '@nestjs/common';
import { RateLimitService } from './rate-limit.service.js';

// The middlewares are applied in AppModule.configure(), which resolves their
// RateLimitService dependency through this export.
@Module({
  providers: [RateLimitService],
  exports: [RateLimitService],
})
export class RateLimitModule {}
