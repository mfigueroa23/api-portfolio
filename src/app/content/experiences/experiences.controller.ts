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
import { LangQueryDto, langOf } from '../common/lang.js';
import { ExperienceDto } from './dto/experiences.dto.js';
import { ExperiencesService } from './experiences.service.js';
import type {
  AdminExperience,
  ExperienceListItem,
  ExperienceResponse,
} from './experiences.service.js';

// Reading is public; writing requires the administrator's token.
@Controller('content/experiences')
export class ExperiencesController {
  constructor(private readonly service: ExperiencesService) {}

  @Get()
  list(@Query() query?: LangQueryDto): Promise<ExperienceListItem[]> {
    return this.service.list(langOf(query));
  }

  @Get('all')
  @UseGuards(JwtAuthGuard)
  listAll(): Promise<AdminExperience[]> {
    return this.service.listAll();
  }

  @Post()
  @UseGuards(JwtAuthGuard)
  create(@Body() dto: ExperienceDto): Promise<ExperienceResponse> {
    return this.service.create(dto);
  }

  @Put(':id')
  @UseGuards(JwtAuthGuard)
  update(
    @Param('id', ParseIntPipe) id: number,
    @Body() dto: ExperienceDto,
  ): Promise<ExperienceResponse> {
    return this.service.update(id, dto);
  }

  @Delete(':id')
  @UseGuards(JwtAuthGuard)
  @HttpCode(HttpStatus.NO_CONTENT)
  remove(@Param('id', ParseIntPipe) id: number): Promise<void> {
    return this.service.remove(id);
  }
}
