import { Module } from '@nestjs/common';
import { AuthModule } from '../../auth/auth.module.js';
import { MarkdownModule } from '../../markdown/markdown.module.js';
import { ExperiencesController } from './experiences.controller.js';
import { ExperiencesService } from './experiences.service.js';

@Module({
  imports: [AuthModule, MarkdownModule],
  controllers: [ExperiencesController],
  providers: [ExperiencesService],
})
export class ExperiencesModule {}
