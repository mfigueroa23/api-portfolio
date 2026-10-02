import { Module } from '@nestjs/common';
import { AuthModule } from '../../auth/auth.module.js';
import { HighlightsController } from './highlights.controller.js';
import { HighlightsService } from './highlights.service.js';

@Module({
  imports: [AuthModule],
  controllers: [HighlightsController],
  providers: [HighlightsService],
})
export class HighlightsModule {}
