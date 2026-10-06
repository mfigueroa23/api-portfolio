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
import {
  CreateTestimonialDto,
  UpdateTestimonialDto,
} from './dto/testimonials.dto.js';
import {
  PublicTestimonial,
  TestimonialsService,
} from './testimonials.service.js';

// The public list only ever has approved items; the owner reads and reviews
// everything with the token. /all and /pending-count come before /:id.
@Controller('content/testimonials')
export class TestimonialsController {
  constructor(private readonly service: TestimonialsService) {}

  @Get()
  list(): Promise<PublicTestimonial[]> {
    return this.service.listApproved();
  }

  @Get('all')
  @UseGuards(JwtAuthGuard)
  listAll(): Promise<Testimonial[]> {
    return this.service.listAll();
  }

  @Get('pending-count')
  @UseGuards(JwtAuthGuard)
  pendingCount(): Promise<{ count: number }> {
    return this.service.pendingCount();
  }

  @Post()
  @UseGuards(JwtAuthGuard)
  create(@Body() dto: CreateTestimonialDto): Promise<Testimonial> {
    return this.service.create(dto);
  }

  @Put(':id')
  @UseGuards(JwtAuthGuard)
  update(
    @Param('id', ParseIntPipe) id: number,
    @Body() dto: UpdateTestimonialDto,
  ): Promise<Testimonial> {
    return this.service.update(id, dto);
  }

  @Post(':id/approve')
  @UseGuards(JwtAuthGuard)
  @HttpCode(HttpStatus.OK)
  approve(
    @Param('id', ParseIntPipe) id: number,
    @Body() dto: UpdateTestimonialDto,
  ): Promise<Testimonial> {
    return this.service.approve(id, dto);
  }

  // Deletes an item; for a pending one this is the rejection.
  @Delete(':id')
  @UseGuards(JwtAuthGuard)
  @HttpCode(HttpStatus.NO_CONTENT)
  remove(@Param('id', ParseIntPipe) id: number): Promise<void> {
    return this.service.remove(id);
  }
}
