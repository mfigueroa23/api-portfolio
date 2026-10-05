import { Module } from '@nestjs/common';
import { AuthModule } from '../../auth/auth.module.js';
import { MarkdownModule } from '../../markdown/markdown.module.js';
import { PostsController } from './posts.controller.js';
import { PostsService } from './posts.service.js';

@Module({
  imports: [AuthModule, MarkdownModule],
  controllers: [PostsController],
  providers: [PostsService],
})
export class PostsModule {}
