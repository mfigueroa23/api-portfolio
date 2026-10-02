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
  UseGuards,
} from '@nestjs/common';
import { JwtAuthGuard } from '../../auth/guards/jwt-auth.guard.js';
import { Project } from '../../../generated/prisma/client.js';
import { ProjectDto } from './dto/projects.dto.js';
import { ProjectsService } from './projects.service.js';

// Reading is public; writing requires the administrator's token.
@Controller('content/projects')
export class ProjectsController {
  constructor(private readonly service: ProjectsService) {}

  @Get()
  list(): Promise<Project[]> {
    return this.service.list();
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

  @Delete(':id')
  @UseGuards(JwtAuthGuard)
  @HttpCode(HttpStatus.NO_CONTENT)
  remove(@Param('id', ParseIntPipe) id: number): Promise<void> {
    return this.service.remove(id);
  }
}
