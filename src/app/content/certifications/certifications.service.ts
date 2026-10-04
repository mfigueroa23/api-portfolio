import { Injectable } from '@nestjs/common';
import { PrismaService } from '../../database/prisma.service.js';
import { Certification } from '../../../generated/prisma/client.js';
import { calendarToDate, dateToCalendar } from '../common/calendar-dates.js';
import { CertificationDto } from './dto/certifications.dto.js';

// Dates leave the API as YYYY-MM-DD, exactly as entered.
export type CertificationResponse = Omit<
  Certification,
  'issueDate' | 'expiryDate'
> & { issueDate: string; expiryDate: string | null };

function toData(dto: CertificationDto) {
  return {
    position: dto.position,
    name: dto.name,
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
  async list(): Promise<CertificationResponse[]> {
    const rows = await this.prisma.certification.findMany({
      orderBy: [{ position: 'asc' }, { id: 'asc' }],
    });
    return rows.map(toResponse);
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
