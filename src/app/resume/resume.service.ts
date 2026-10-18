import {
  BadRequestException,
  ConflictException,
  Injectable,
  NotFoundException,
} from '@nestjs/common';
import type { Lang } from '../content/common/lang.js';
import { PrismaService } from '../database/prisma.service.js';
import { FilesService } from '../files/files.service.js';
import type { FileMeta, StoredFile } from '../files/files.service.js';
import { RESUME_LANGS } from './dto/resume-lang.dto.js';

export interface ResumeAssignment {
  file: FileMeta;
  assignedAt: Date;
}

export type ResumeAssignments = Record<Lang, ResumeAssignment | null>;

const NOT_PDF = 'The resume must be a PDF file.';

// Which library PDF is the current resume per language (Spec 005). English is
// the base: Spanish needs it and falls back to it. The file keeps its own
// immutable /files/:id URL; GET /resume always serves the current one.
@Injectable()
export class ResumeService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly files: FilesService,
  ) {}

  async assignments(): Promise<ResumeAssignments> {
    const rows = await this.prisma.resume.findMany();
    const [en, es] = await Promise.all(
      RESUME_LANGS.map(async (lang) => {
        const row = rows.find((candidate) => candidate.lang === lang);
        if (!row) return null;
        const file = await this.files.meta(row.fileId);
        return { file, assignedAt: row.assignedAt };
      }),
    );
    return { en, es };
  }

  // The type is the one detected from the content at upload (plan D6).
  // Assigning the current file again writes nothing (RF-09, plan D11).
  async assign(lang: Lang, fileId: string): Promise<ResumeAssignments> {
    const file = await this.files.meta(fileId);
    if (file.mime !== 'application/pdf') {
      throw new BadRequestException({
        error: NOT_PDF,
        fields: { fileId: [NOT_PDF] },
      });
    }
    await this.prisma.$transaction(async (tx) => {
      const rows = await tx.resume.findMany();
      if (lang === 'es' && !rows.some((row) => row.lang === 'en')) {
        throw new ConflictException('Assign an English resume first.');
      }
      if (rows.some((row) => row.lang === lang && row.fileId === file.id)) {
        return;
      }
      await tx.resume.upsert({
        where: { lang },
        create: { lang, fileId: file.id },
        update: { fileId: file.id, assignedAt: new Date() },
      });
    });
    return this.assignments();
  }

  // The file stays in the library. Clearing a language without a resume is a
  // no-op (RF-11).
  async clear(lang: Lang): Promise<void> {
    await this.prisma.$transaction(async (tx) => {
      if (lang === 'en' && (await tx.resume.count({ where: { lang: 'es' } }))) {
        throw new ConflictException('Clear the Spanish resume first.');
      }
      await tx.resume.deleteMany({ where: { lang } });
    });
  }

  // English when `lang` is left out; Spanish falls back to English, never the
  // other way round (RF-14 – RF-16).
  async publicFile(lang: Lang = 'en'): Promise<StoredFile> {
    const rows = await this.prisma.resume.findMany();
    const row =
      rows.find((candidate) => candidate.lang === lang) ??
      rows.find((candidate) => candidate.lang === 'en');
    if (!row) throw new NotFoundException('Not found.');
    return this.files.read(row.fileId);
  }
}
