import { Injectable } from '@nestjs/common';
import { PrismaService } from '../../database/prisma.service.js';
import { Highlight } from '../../../generated/prisma/client.js';
import { HighlightDto } from './dto/highlights.dto.js';

@Injectable()
export class HighlightsService {
  constructor(private readonly prisma: PrismaService) {}

  // Display order set by the owner; id breaks ties so the order is stable.
  list(): Promise<Highlight[]> {
    return this.prisma.highlight.findMany({
      orderBy: [{ position: 'asc' }, { id: 'asc' }],
    });
  }

  create(dto: HighlightDto): Promise<Highlight> {
    return this.prisma.highlight.create({ data: dto });
  }

  // A missing id makes Prisma throw P2025, which the filter turns into 404.
  update(id: number, dto: HighlightDto): Promise<Highlight> {
    return this.prisma.highlight.update({ where: { id }, data: dto });
  }

  async remove(id: number): Promise<void> {
    await this.prisma.highlight.delete({ where: { id } });
  }
}
