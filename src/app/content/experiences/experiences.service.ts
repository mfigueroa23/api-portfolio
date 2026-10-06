import { Injectable } from '@nestjs/common';
import { PrismaService } from '../../database/prisma.service.js';
import { Experience, Prisma } from '../../../generated/prisma/client.js';
import { MarkdownService } from '../../markdown/markdown.service.js';
import { dateToMonth, monthToDate } from '../common/calendar-dates.js';
import type { Lang } from '../common/lang.js';
import {
  BILINGUAL_FIELDS,
  isTranslated,
  localize,
  Localized,
} from '../common/translation.js';
import { ExperienceDto } from './dto/experiences.dto.js';

// startDate leaves the API as YYYY-MM (null for entries created before it).
export type ExperienceResponse = Omit<Experience, 'startDate'> & {
  startDate: string | null;
};
const FIELDS = BILINGUAL_FIELDS.experiences;
export type ExperienceListItem = Localized<
  ExperienceResponse,
  (typeof FIELDS)[number]
> & { bodyHtml: string };
export type AdminExperience = ExperienceResponse & { translated: boolean };
const ORDER: Prisma.ExperienceOrderByWithRelationInput[] = [
  { current: 'desc' },
  { startDate: { sort: 'desc', nulls: 'last' } },
  { id: 'asc' },
];

function toData(dto: ExperienceDto) {
  return {
    period: dto.period,
    periodEs: dto.periodEs ?? null,
    role: dto.role,
    roleEs: dto.roleEs ?? null,
    company: dto.company,
    description: dto.description,
    descriptionEs: dto.descriptionEs ?? null,
    technologies: dto.technologies,
    current: dto.current,
    startDate: monthToDate(dto.startDate),
    body: dto.body ?? null,
    bodyEs: dto.bodyEs ?? null,
  };
}

function toResponse(row: Experience): ExperienceResponse {
  return { ...row, startDate: dateToMonth(row.startDate) };
}

@Injectable()
export class ExperiencesService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly markdown: MarkdownService,
  ) {}

  // Current entries first, then the latest start date; entries without a
  // start date (created before it existed) go last; id keeps ties stable.
  // The body is rendered from the language shown (RF-158).
  async list(lang: Lang = 'en'): Promise<ExperienceListItem[]> {
    const rows = await this.prisma.experience.findMany({ orderBy: ORDER });
    return rows.map((row) => {
      const item = localize(toResponse(row), FIELDS, lang);
      return {
        ...item,
        bodyHtml: item.body ? this.markdown.render(item.body).html : '',
      };
    });
  }

  // Owner list: raw rows with the Spanish fields and the RF-149 flag.
  async listAll(): Promise<AdminExperience[]> {
    const rows = await this.prisma.experience.findMany({ orderBy: ORDER });
    return rows.map((row) => ({
      ...toResponse(row),
      translated: isTranslated(row, FIELDS),
    }));
  }

  async create(dto: ExperienceDto): Promise<ExperienceResponse> {
    return toResponse(
      await this.prisma.experience.create({ data: toData(dto) }),
    );
  }

  // A missing id makes Prisma throw P2025, which the filter turns into 404.
  async update(id: number, dto: ExperienceDto): Promise<ExperienceResponse> {
    return toResponse(
      await this.prisma.experience.update({ where: { id }, data: toData(dto) }),
    );
  }

  async remove(id: number): Promise<void> {
    await this.prisma.experience.delete({ where: { id } });
  }
}
