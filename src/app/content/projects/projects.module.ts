import { Module } from '@nestjs/common';
import { AuthModule } from '../../auth/auth.module.js';
import { MarkdownModule } from '../../markdown/markdown.module.js';
import { ProjectsController } from './projects.controller.js';
import { ProjectsService } from './projects.service.js';

@Module({
  imports: [AuthModule, MarkdownModule],
  controllers: [ProjectsController],
  providers: [ProjectsService],
})
export class ProjectsModule {}
