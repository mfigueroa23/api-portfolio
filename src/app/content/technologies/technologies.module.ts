import { Module } from '@nestjs/common';
import { AuthModule } from '../../auth/auth.module.js';
import { TechnologiesController } from './technologies.controller.js';
import { TechnologiesService } from './technologies.service.js';

@Module({
  imports: [AuthModule],
  controllers: [TechnologiesController],
  providers: [TechnologiesService],
})
export class TechnologiesModule {}
