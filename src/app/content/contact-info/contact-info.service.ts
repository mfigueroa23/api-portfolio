import { Injectable } from '@nestjs/common';
import { PrismaService } from '../../database/prisma.service.js';
import { ContactInfo } from '../../../generated/prisma/client.js';
import type { Lang } from '../common/lang.js';
import {
  BILINGUAL_FIELDS,
  isTranslated,
  localize,
  Localized,
} from '../common/translation.js';
import { ContactInfoDto } from './dto/contact-info.dto.js';

const FIELDS = BILINGUAL_FIELDS.contactInfo;
// Display order set by the owner; id breaks ties so the order is stable.
const ORDER = [{ position: 'asc' as const }, { id: 'asc' as const }];

export type LocalizedContactInfo = Localized<
  ContactInfo,
  (typeof FIELDS)[number]
>;
export type AdminContactInfo = ContactInfo & { translated: boolean };

// PUT replaces the whole item, so a Spanish value left out is cleared.
function toData(dto: ContactInfoDto) {
  return {
    position: dto.position,
    icon: dto.icon,
    label: dto.label,
    labelEs: dto.labelEs ?? null,
    value: dto.value,
    href: dto.href,
  };
}

@Injectable()
export class ContactInfoService {
  constructor(private readonly prisma: PrismaService) {}

  async list(lang: Lang = 'en'): Promise<LocalizedContactInfo[]> {
    const rows = await this.prisma.contactInfo.findMany({ orderBy: ORDER });
    return rows.map((row) => localize(row, FIELDS, lang));
  }

  // Owner list: raw rows with the Spanish fields and the RF-149 flag.
  async listAll(): Promise<AdminContactInfo[]> {
    const rows = await this.prisma.contactInfo.findMany({ orderBy: ORDER });
    return rows.map((row) => ({
      ...row,
      translated: isTranslated(row, FIELDS),
    }));
  }

  create(dto: ContactInfoDto): Promise<ContactInfo> {
    return this.prisma.contactInfo.create({ data: toData(dto) });
  }

  // A missing id makes Prisma throw P2025, which the filter turns into 404.
  update(id: number, dto: ContactInfoDto): Promise<ContactInfo> {
    return this.prisma.contactInfo.update({ where: { id }, data: toData(dto) });
  }

  async remove(id: number): Promise<void> {
    await this.prisma.contactInfo.delete({ where: { id } });
  }
}
