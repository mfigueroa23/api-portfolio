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
import { Testimonial } from '../../../generated/prisma/client.js';
import { TestimonialDto } from './dto/testimonials.dto.js';
import { TestimonialsService } from './testimonials.service.js';

// Reading is public; writing requires the administrator's token.
@Controller('content/testimonials')
export class TestimonialsController {
  constructor(private readonly service: TestimonialsService) {}

  @Get()
  list(): Promise<Testimonial[]> {
    return this.service.list();
  }

  @Post()
  @UseGuards(JwtAuthGuard)
  create(@Body() dto: TestimonialDto): Promise<Testimonial> {
    return this.service.create(dto);
  }

  @Put(':id')
  @UseGuards(JwtAuthGuard)
  update(
    @Param('id', ParseIntPipe) id: number,
    @Body() dto: TestimonialDto,
  ): Promise<Testimonial> {
    return this.service.update(id, dto);
  }

  @Delete(':id')
  @UseGuards(JwtAuthGuard)
  @HttpCode(HttpStatus.NO_CONTENT)
  remove(@Param('id', ParseIntPipe) id: number): Promise<void> {
    return this.service.remove(id);
  }
}
