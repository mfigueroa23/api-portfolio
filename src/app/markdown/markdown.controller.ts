import {
  Body,
  Controller,
  HttpCode,
  HttpStatus,
  Post,
  UseGuards,
} from '@nestjs/common';
import { JwtAuthGuard } from '../auth/guards/jwt-auth.guard.js';
import { RenderMarkdownDto } from './dto/render-markdown.dto.js';
import { MarkdownService } from './markdown.service.js';
import type { RenderedMarkdown } from './markdown.service.js';

// Used by the panel preview, so preview and site share one renderer.
@Controller('markdown')
export class MarkdownController {
  constructor(private readonly service: MarkdownService) {}

  @Post('render')
  @UseGuards(JwtAuthGuard)
  @HttpCode(HttpStatus.OK)
  render(@Body() dto: RenderMarkdownDto): RenderedMarkdown {
    return this.service.render(dto.markdown);
  }
}
