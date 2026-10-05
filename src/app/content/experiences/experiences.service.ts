import { Injectable } from '@nestjs/common';
import { PrismaService } from '../../database/prisma.service.js';
import { Experience } from '../../../generated/prisma/client.js';
import { MarkdownService } from '../../markdown/markdown.service.js';
import { dateToMonth, monthToDate } from '../common/calendar-dates.js';
import { ExperienceDto } from './dto/experiences.dto.js';

// startDate leaves the API as YYYY-MM (null for entries created before it).
export type ExperienceResponse = Omit<Experience, 'startDate'> & {
  startDate: string | null;
};
export type ExperienceListItem = ExperienceResponse & { bodyHtml: string };

function toData(dto: ExperienceDto) {
  return {
    period: dto.period,
    role: dto.role,
    company: dto.company,
    description: dto.description,
    technologies: dto.technologies,
    current: dto.current,
    startDate: monthToDate(dto.startDate),
    body: dto.body ?? null,
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
  async list(): Promise<ExperienceListItem[]> {
    const rows = await this.prisma.experience.findMany({
      orderBy: [
        { current: 'desc' },
        { startDate: { sort: 'desc', nulls: 'last' } },
        { id: 'asc' },
      ],
    });
    return rows.map((row) => ({
      ...toResponse(row),
      bodyHtml: row.body ? this.markdown.render(row.body).html : '',
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
