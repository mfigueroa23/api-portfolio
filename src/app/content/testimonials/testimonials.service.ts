import { Injectable } from '@nestjs/common';
import { PrismaService } from '../../database/prisma.service.js';
import { Testimonial } from '../../../generated/prisma/client.js';
import { TestimonialDto } from './dto/testimonials.dto.js';

@Injectable()
export class TestimonialsService {
  constructor(private readonly prisma: PrismaService) {}

  // Display order set by the owner; id breaks ties so the order is stable.
  list(): Promise<Testimonial[]> {
    return this.prisma.testimonial.findMany({
      orderBy: [{ position: 'asc' }, { id: 'asc' }],
    });
  }

  create(dto: TestimonialDto): Promise<Testimonial> {
    return this.prisma.testimonial.create({ data: dto });
  }

  // A missing id makes Prisma throw P2025, which the filter turns into 404.
  update(id: number, dto: TestimonialDto): Promise<Testimonial> {
    return this.prisma.testimonial.update({ where: { id }, data: dto });
  }

  async remove(id: number): Promise<void> {
    await this.prisma.testimonial.delete({ where: { id } });
  }
}
