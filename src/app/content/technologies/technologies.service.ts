import { Injectable } from '@nestjs/common';
import { PrismaService } from '../../database/prisma.service.js';
import { Technology } from '../../../generated/prisma/client.js';
import { TechnologyDto } from './dto/technologies.dto.js';

@Injectable()
export class TechnologiesService {
  constructor(private readonly prisma: PrismaService) {}

  // Display order set by the owner; id breaks ties so the order is stable.
  list(): Promise<Technology[]> {
    return this.prisma.technology.findMany({
      orderBy: [{ position: 'asc' }, { id: 'asc' }],
    });
  }

  create(dto: TechnologyDto): Promise<Technology> {
    return this.prisma.technology.create({ data: dto });
  }

  // A missing id makes Prisma throw P2025, which the filter turns into 404.
  update(id: number, dto: TechnologyDto): Promise<Technology> {
    return this.prisma.technology.update({ where: { id }, data: dto });
  }

  async remove(id: number): Promise<void> {
    await this.prisma.technology.delete({ where: { id } });
  }
}
