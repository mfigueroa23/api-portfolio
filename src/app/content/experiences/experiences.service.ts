import { Injectable } from '@nestjs/common';
import { PrismaService } from '../../database/prisma.service.js';
import { Experience } from '../../../generated/prisma/client.js';
import { ExperienceDto } from './dto/experiences.dto.js';

@Injectable()
export class ExperiencesService {
  constructor(private readonly prisma: PrismaService) {}

  // Display order set by the owner; id breaks ties so the order is stable.
  list(): Promise<Experience[]> {
    return this.prisma.experience.findMany({
      orderBy: [{ position: 'asc' }, { id: 'asc' }],
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
