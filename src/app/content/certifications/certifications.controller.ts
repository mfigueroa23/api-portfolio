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
import { CertificationDto } from './dto/certifications.dto.js';
import { CertificationsService } from './certifications.service.js';
import type { CertificationResponse } from './certifications.service.js';

// Reading is public; writing requires the administrator's token.
@Controller('content/certifications')
export class CertificationsController {
  constructor(private readonly service: CertificationsService) {}

  @Get()
  list(): Promise<CertificationResponse[]> {
    return this.service.list();
  }

  @Post()
  @UseGuards(JwtAuthGuard)
  create(@Body() dto: CertificationDto): Promise<CertificationResponse> {
    return this.service.create(dto);
  }

  @Put(':id')
  @UseGuards(JwtAuthGuard)
  update(
    @Param('id', ParseIntPipe) id: number,
    @Body() dto: CertificationDto,
  ): Promise<CertificationResponse> {
    return this.service.update(id, dto);
  }

  @Delete(':id')
  @UseGuards(JwtAuthGuard)
  @HttpCode(HttpStatus.NO_CONTENT)
  remove(@Param('id', ParseIntPipe) id: number): Promise<void> {
    return this.service.remove(id);
  }
}
