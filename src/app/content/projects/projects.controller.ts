import {
  Body,
  Controller,
  Delete,
  Get,
  HttpCode,
  HttpStatus,
  Param,
  ParseIntPipe,
  Post,
  Put,
  Query,
  UseGuards,
} from '@nestjs/common';
import { JwtAuthGuard } from '../../auth/guards/jwt-auth.guard.js';
import { Project } from '../../../generated/prisma/client.js';
import { LangQueryDto, langOf } from '../common/lang.js';
import { ListProjectsQueryDto, ProjectDto } from './dto/projects.dto.js';
import { ProjectsService } from './projects.service.js';
import type {
  AdminProject,
  ProjectDetail,
  ProjectSummary,
} from './projects.service.js';

// Public reads only ever see published projects; the owner reads everything
// through /all (declared before /:slug) and writes with the token.
@Controller('content/projects')
export class ProjectsController {
  constructor(private readonly service: ProjectsService) {}

  @Get()
  list(@Query() query: ListProjectsQueryDto): Promise<ProjectSummary[]> {
    return this.service.listPublished(query.limit, langOf(query));
  }

  @Get('all')
  @UseGuards(JwtAuthGuard)
  listAll(): Promise<AdminProject[]> {
    return this.service.listAll();
  }

  @Get(':slug')
  findBySlug(
    @Param('slug') slug: string,
    @Query() query?: LangQueryDto,
  ): Promise<ProjectDetail> {
    return this.service.findPublishedBySlug(slug, langOf(query));
  }

  @Post()
  @UseGuards(JwtAuthGuard)
  create(@Body() dto: ProjectDto): Promise<Project> {
    return this.service.create(dto);
  }

  @Put(':id')
  @UseGuards(JwtAuthGuard)
  update(
    @Param('id', ParseIntPipe) id: number,
    @Body() dto: ProjectDto,
  ): Promise<Project> {
    return this.service.update(id, dto);
  }

  @Post(':id/publish')
  @UseGuards(JwtAuthGuard)
  @HttpCode(HttpStatus.OK)
  publish(@Param('id', ParseIntPipe) id: number): Promise<Project> {
    return this.service.publish(id);
  }

  @Post(':id/unpublish')
  @UseGuards(JwtAuthGuard)
  @HttpCode(HttpStatus.OK)
  unpublish(@Param('id', ParseIntPipe) id: number): Promise<Project> {
    return this.service.unpublish(id);
  }

  @Delete(':id')
  @UseGuards(JwtAuthGuard)
  @HttpCode(HttpStatus.NO_CONTENT)
  remove(@Param('id', ParseIntPipe) id: number): Promise<void> {
    return this.service.remove(id);
  }
}
