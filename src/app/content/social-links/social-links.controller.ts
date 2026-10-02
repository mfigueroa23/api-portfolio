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
import { SocialLink } from '../../../generated/prisma/client.js';
import { SocialLinkDto } from './dto/social-links.dto.js';
import { SocialLinksService } from './social-links.service.js';

// Reading is public; writing requires the administrator's token.
@Controller('content/social-links')
export class SocialLinksController {
  constructor(private readonly service: SocialLinksService) {}

  @Get()
  list(): Promise<SocialLink[]> {
    return this.service.list();
  }

  @Post()
  @UseGuards(JwtAuthGuard)
  create(@Body() dto: SocialLinkDto): Promise<SocialLink> {
    return this.service.create(dto);
  }

  @Put(':id')
  @UseGuards(JwtAuthGuard)
  update(
    @Param('id', ParseIntPipe) id: number,
    @Body() dto: SocialLinkDto,
  ): Promise<SocialLink> {
    return this.service.update(id, dto);
  }

  @Delete(':id')
  @UseGuards(JwtAuthGuard)
  @HttpCode(HttpStatus.NO_CONTENT)
  remove(@Param('id', ParseIntPipe) id: number): Promise<void> {
    return this.service.remove(id);
  }
}
