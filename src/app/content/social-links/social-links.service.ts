import { Injectable } from '@nestjs/common';
import { PrismaService } from '../../database/prisma.service.js';
import { SocialLink } from '../../../generated/prisma/client.js';
import { SocialLinkDto } from './dto/social-links.dto.js';

@Injectable()
export class SocialLinksService {
  constructor(private readonly prisma: PrismaService) {}

  // Display order set by the owner; id breaks ties so the order is stable.
  list(): Promise<SocialLink[]> {
    return this.prisma.socialLink.findMany({
      orderBy: [{ position: 'asc' }, { id: 'asc' }],
    });
  }

  create(dto: SocialLinkDto): Promise<SocialLink> {
    return this.prisma.socialLink.create({ data: dto });
  }

  // A missing id makes Prisma throw P2025, which the filter turns into 404.
  update(id: number, dto: SocialLinkDto): Promise<SocialLink> {
    return this.prisma.socialLink.update({ where: { id }, data: dto });
  }

  async remove(id: number): Promise<void> {
    await this.prisma.socialLink.delete({ where: { id } });
  }
}
