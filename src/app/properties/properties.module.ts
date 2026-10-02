import { Global, Module } from '@nestjs/common';
import { PropertiesService } from './properties.service.js';

// No controller on purpose: configuration values are managed only with SQL.
@Global()
@Module({
  providers: [PropertiesService],
  exports: [PropertiesService],
})
export class PropertiesModule {}
