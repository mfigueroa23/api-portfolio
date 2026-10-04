import { Injectable } from '@nestjs/common';
import { PrismaService } from '../../database/prisma.service.js';
import { Experience } from '../../../generated/prisma/client.js';
import { ExperienceDto } from './dto/experiences.dto.js';

@Injectable()
export class ExperiencesService {
  constructor(private readonly prisma: PrismaService) {}

  // Current entries first, then the latest start date; entries without a
  // start date (created before it existed) go last; id keeps ties stable.
  list(): Promise<Experience[]> {
    return this.prisma.experience.findMany({
      orderBy: [
        { current: 'desc' },
        { startDate: { sort: 'desc', nulls: 'last' } },
        { id: 'asc' },
      ],
    });
  }

  create(dto: ExperienceDto): Promise<Experience> {
    return this.prisma.experience.create({ data: dto });
  }

  // A missing id makes Prisma throw P2025, which the filter turns into 404.
  update(id: number, dto: ExperienceDto): Promise<Experience> {
    return this.prisma.experience.update({ where: { id }, data: dto });
  }

  async remove(id: number): Promise<void> {
    await this.prisma.experience.delete({ where: { id } });
  }
}
