import { Global, Module } from '@nestjs/common';
import { CorsOriginsService } from './cors-origins.service.js';

// No controller on purpose: origins are managed only with SQL.
@Global()
@Module({
  providers: [CorsOriginsService],
  exports: [CorsOriginsService],
})
export class CorsModule {}
