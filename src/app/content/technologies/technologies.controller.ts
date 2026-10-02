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
import { Technology } from '../../../generated/prisma/client.js';
import { TechnologyDto } from './dto/technologies.dto.js';
import { TechnologiesService } from './technologies.service.js';

// Reading is public; writing requires the administrator's token.
@Controller('content/technologies')
export class TechnologiesController {
  constructor(private readonly service: TechnologiesService) {}

  @Get()
  list(): Promise<Technology[]> {
    return this.service.list();
  }

  @Post()
  @UseGuards(JwtAuthGuard)
  create(@Body() dto: TechnologyDto): Promise<Technology> {
    return this.service.create(dto);
  }

  @Put(':id')
  @UseGuards(JwtAuthGuard)
  update(
    @Param('id', ParseIntPipe) id: number,
    @Body() dto: TechnologyDto,
  ): Promise<Technology> {
    return this.service.update(id, dto);
  }

  @Delete(':id')
  @UseGuards(JwtAuthGuard)
  @HttpCode(HttpStatus.NO_CONTENT)
  remove(@Param('id', ParseIntPipe) id: number): Promise<void> {
    return this.service.remove(id);
  }
}
