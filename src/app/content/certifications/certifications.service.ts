import { Injectable } from '@nestjs/common';
import { PrismaService } from '../../database/prisma.service.js';
import { Certification } from '../../../generated/prisma/client.js';
import { calendarToDate, dateToCalendar } from '../common/calendar-dates.js';
import type { Lang } from '../common/lang.js';
import {
  BILINGUAL_FIELDS,
  isTranslated,
  localize,
  Localized,
} from '../common/translation.js';
import { CertificationDto } from './dto/certifications.dto.js';

// Dates leave the API as YYYY-MM-DD, exactly as entered.
export type CertificationResponse = Omit<
  Certification,
  'issueDate' | 'expiryDate'
> & { issueDate: string; expiryDate: string | null };

const FIELDS = BILINGUAL_FIELDS.certifications;
const ORDER = [{ position: 'asc' as const }, { id: 'asc' as const }];
export type LocalizedCertification = Localized<
  CertificationResponse,
  (typeof FIELDS)[number]
>;
export type AdminCertification = CertificationResponse & {
  translated: boolean;
};

function toData(dto: CertificationDto) {
  return {
    position: dto.position,
    name: dto.name,
    nameEs: dto.nameEs ?? null,
    issuer: dto.issuer,
    issueDate: calendarToDate(dto.issueDate),
    expiryDate: calendarToDate(dto.expiryDate),
    credentialId: dto.credentialId ?? null,
    verificationUrl: dto.verificationUrl ?? null,
    fileUrl: dto.fileUrl ?? null,
  };
}

function toResponse(row: Certification): CertificationResponse {
  return {
    ...row,
    issueDate: dateToCalendar(row.issueDate)!,
    expiryDate: dateToCalendar(row.expiryDate),
  };
}

@Injectable()
export class CertificationsService {
  constructor(private readonly prisma: PrismaService) {}

  // Display order set by the owner; id breaks ties so the order is stable.
  async list(lang: Lang = 'en'): Promise<LocalizedCertification[]> {
    const rows = await this.prisma.certification.findMany({ orderBy: ORDER });
    return rows.map((row) => localize(toResponse(row), FIELDS, lang));
  }

  // Owner list: raw rows with the Spanish fields and the RF-149 flag.
  async listAll(): Promise<AdminCertification[]> {
    const rows = await this.prisma.certification.findMany({ orderBy: ORDER });
    return rows.map((row) => ({
      ...toResponse(row),
      translated: isTranslated(row, FIELDS),
    }));
  }

  async create(dto: CertificationDto): Promise<CertificationResponse> {
    return toResponse(
      await this.prisma.certification.create({ data: toData(dto) }),
    );
  }

  // A missing id makes Prisma throw P2025, which the filter turns into 404.
  async update(
    id: number,
    dto: CertificationDto,
  ): Promise<CertificationResponse> {
    return toResponse(
      await this.prisma.certification.update({
        where: { id },
        data: toData(dto),
      }),
    );
  }

  async remove(id: number): Promise<void> {
    await this.prisma.certification.delete({ where: { id } });
  }
}
