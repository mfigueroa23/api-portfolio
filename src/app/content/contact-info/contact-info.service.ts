import { Injectable } from '@nestjs/common';
import { PrismaService } from '../../database/prisma.service.js';
import { ContactInfo } from '../../../generated/prisma/client.js';
import { ContactInfoDto } from './dto/contact-info.dto.js';

@Injectable()
export class ContactInfoService {
  constructor(private readonly prisma: PrismaService) {}

  // Display order set by the owner; id breaks ties so the order is stable.
  list(): Promise<ContactInfo[]> {
    return this.prisma.contactInfo.findMany({
      orderBy: [{ position: 'asc' }, { id: 'asc' }],
    });
  }

  create(dto: ContactInfoDto): Promise<ContactInfo> {
    return this.prisma.contactInfo.create({ data: dto });
  }

  // A missing id makes Prisma throw P2025, which the filter turns into 404.
  update(id: number, dto: ContactInfoDto): Promise<ContactInfo> {
    return this.prisma.contactInfo.update({ where: { id }, data: dto });
  }

  async remove(id: number): Promise<void> {
    await this.prisma.contactInfo.delete({ where: { id } });
  }
}
