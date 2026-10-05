import { Module } from '@nestjs/common';
import { AuthModule } from '../auth/auth.module.js';
import { MarkdownController } from './markdown.controller.js';
import { MarkdownService } from './markdown.service.js';

// Exports MarkdownService for the content modules that render bodies.
@Module({
  imports: [AuthModule],
  controllers: [MarkdownController],
  providers: [MarkdownService],
  exports: [MarkdownService],
})
export class MarkdownModule {}
