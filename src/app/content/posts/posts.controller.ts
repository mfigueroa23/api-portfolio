import {
  Body,
  Controller,
  Delete,
  Get,
  HttpCode,
  HttpStatus,
  Param,
  ParseIntPipe,
  Post as HttpPost,
  Put,
  Query,
  UseGuards,
} from '@nestjs/common';
import { JwtAuthGuard } from '../../auth/guards/jwt-auth.guard.js';
import { Post } from '../../../generated/prisma/client.js';
import { LangQueryDto, langOf } from '../common/lang.js';
import { ListPostsQueryDto, PostDto } from './dto/post.dto.js';
import { PostsService } from './posts.service.js';
import type {
  AdminPost,
  PostDetail,
  PostPage,
  PostSummary,
} from './posts.service.js';

// Public reads only ever see published posts; /feed and /all are declared
// before /:slug so they are not taken for slugs.
@Controller('content/posts')
export class PostsController {
  constructor(private readonly service: PostsService) {}

  @Get()
  list(@Query() query: ListPostsQueryDto): Promise<PostPage> {
    return this.service.listPublished({
      page: query.page ?? 1,
      tag: query.tag,
      lang: langOf(query),
    });
  }

  @Get('feed')
  feed(@Query() query?: LangQueryDto): Promise<PostSummary[]> {
    return this.service.feed(langOf(query));
  }

  @Get('all')
  @UseGuards(JwtAuthGuard)
  listAll(): Promise<AdminPost[]> {
    return this.service.listAll();
  }

  @Get(':slug')
  findBySlug(
    @Param('slug') slug: string,
    @Query() query?: LangQueryDto,
  ): Promise<PostDetail> {
    return this.service.findPublishedBySlug(slug, langOf(query));
  }

  @HttpPost()
  @UseGuards(JwtAuthGuard)
  create(@Body() dto: PostDto): Promise<Post> {
    return this.service.create(dto);
  }

  @Put(':id')
  @UseGuards(JwtAuthGuard)
  update(
    @Param('id', ParseIntPipe) id: number,
    @Body() dto: PostDto,
  ): Promise<Post> {
    return this.service.update(id, dto);
  }

  @HttpPost(':id/publish')
  @UseGuards(JwtAuthGuard)
  @HttpCode(HttpStatus.OK)
  publish(@Param('id', ParseIntPipe) id: number): Promise<Post> {
    return this.service.publish(id);
  }

  @HttpPost(':id/unpublish')
  @UseGuards(JwtAuthGuard)
  @HttpCode(HttpStatus.OK)
  unpublish(@Param('id', ParseIntPipe) id: number): Promise<Post> {
    return this.service.unpublish(id);
  }

  @Delete(':id')
  @UseGuards(JwtAuthGuard)
  @HttpCode(HttpStatus.NO_CONTENT)
  remove(@Param('id', ParseIntPipe) id: number): Promise<void> {
    return this.service.remove(id);
  }
}
