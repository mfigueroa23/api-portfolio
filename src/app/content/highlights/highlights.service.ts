import { Injectable } from '@nestjs/common';
import { PrismaService } from '../../database/prisma.service.js';
import { Highlight } from '../../../generated/prisma/client.js';
import type { Lang } from '../common/lang.js';
import {
  BILINGUAL_FIELDS,
  isTranslated,
  localize,
  Localized,
} from '../common/translation.js';
import { HighlightDto } from './dto/highlights.dto.js';

const FIELDS = BILINGUAL_FIELDS.highlights;
// Display order set by the owner; id breaks ties so the order is stable.
const ORDER = [{ position: 'asc' as const }, { id: 'asc' as const }];

export type LocalizedHighlight = Localized<Highlight, (typeof FIELDS)[number]>;
export type AdminHighlight = Highlight & { translated: boolean };

// PUT replaces the whole item, so a Spanish value left out is cleared.
function toData(dto: HighlightDto) {
  return {
    position: dto.position,
    icon: dto.icon,
    title: dto.title,
    titleEs: dto.titleEs ?? null,
    description: dto.description,
    descriptionEs: dto.descriptionEs ?? null,
  };
}

@Injectable()
export class HighlightsService {
  constructor(private readonly prisma: PrismaService) {}

  async list(lang: Lang = 'en'): Promise<LocalizedHighlight[]> {
    const rows = await this.prisma.highlight.findMany({ orderBy: ORDER });
    return rows.map((row) => localize(row, FIELDS, lang));
  }

  // Owner list: raw rows with the Spanish fields and the RF-149 flag.
  async listAll(): Promise<AdminHighlight[]> {
    const rows = await this.prisma.highlight.findMany({ orderBy: ORDER });
    return rows.map((row) => ({
      ...row,
      translated: isTranslated(row, FIELDS),
    }));
  }

  create(dto: HighlightDto): Promise<Highlight> {
    return this.prisma.highlight.create({ data: toData(dto) });
  }

  // A missing id makes Prisma throw P2025, which the filter turns into 404.
  update(id: number, dto: HighlightDto): Promise<Highlight> {
    return this.prisma.highlight.update({ where: { id }, data: toData(dto) });
  }

  async remove(id: number): Promise<void> {
    await this.prisma.highlight.delete({ where: { id } });
  }
}
