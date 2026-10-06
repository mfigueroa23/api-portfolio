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
import { Highlight } from '../../../generated/prisma/client.js';
import { HighlightDto } from './dto/highlights.dto.js';
import { HighlightsService } from './highlights.service.js';
import type {
  AdminHighlight,
  LocalizedHighlight,
} from './highlights.service.js';

// Reading is public; writing requires the administrator's token.
@Controller('content/highlights')
export class HighlightsController {
  constructor(private readonly service: HighlightsService) {}

  @Get()
  list(@Query() query?: LangQueryDto): Promise<LocalizedHighlight[]> {
    return this.service.list(langOf(query));
  }

  @Get('all')
  @UseGuards(JwtAuthGuard)
  listAll(): Promise<AdminHighlight[]> {
    return this.service.listAll();
  }

  @Post()
  @UseGuards(JwtAuthGuard)
  create(@Body() dto: HighlightDto): Promise<Highlight> {
    return this.service.create(dto);
  }

  @Put(':id')
  @UseGuards(JwtAuthGuard)
  update(
    @Param('id', ParseIntPipe) id: number,
    @Body() dto: HighlightDto,
  ): Promise<Highlight> {
    return this.service.update(id, dto);
  }

  @Delete(':id')
  @UseGuards(JwtAuthGuard)
  @HttpCode(HttpStatus.NO_CONTENT)
  remove(@Param('id', ParseIntPipe) id: number): Promise<void> {
    return this.service.remove(id);
  }
}
