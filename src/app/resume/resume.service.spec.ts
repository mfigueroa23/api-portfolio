import {
  BadRequestException,
  ConflictException,
  NotFoundException,
} from '@nestjs/common';
import { PrismaFake } from '../../../test/fakes/prisma.fake.js';
import { samples } from '../../../test/fixtures/file-samples.js';
import { PrismaService } from '../database/prisma.service.js';
import { FilesService } from '../files/files.service.js';
import type { FileMeta } from '../files/files.service.js';
import { ResumeService } from './resume.service.js';

const UNKNOWN_ID = '2b1e0a4c-5d3f-4e2a-9b8c-7d6e5f4a3b2c';

describe('ResumeService', () => {
  let prisma: PrismaFake;
  let files: FilesService;
  let service: ResumeService;
  let english: FileMeta;
  let spanish: FileMeta;

  beforeEach(async () => {
    vi.stubEnv('API_PUBLIC_URL', 'http://localhost:3000');
    prisma = new PrismaFake();
    files = new FilesService(prisma as unknown as PrismaService);
    service = new ResumeService(prisma as unknown as PrismaService, files);
    english = await files.store('CV.pdf', samples.pdf);
    spanish = await files.store(
      'CV es.pdf',
      Buffer.concat([samples.pdf, Buffer.from('es')]),
    );
  });

  afterEach(() => {
    vi.useRealTimers();
    vi.unstubAllEnvs();
  });

  describe('assignments (U-S1)', () => {
    it('answers null for both languages when nothing is assigned', async () => {
      await expect(service.assignments()).resolves.toEqual({
        en: null,
        es: null,
      });
    });

    it('returns the file metadata with its absolute URL and the date', async () => {
      await service.assign('en', english.id);

      const assignments = await service.assignments();

      expect(assignments).toEqual({
        en: { file: english, assignedAt: expect.any(Date) },
        es: null,
      });
      expect(assignments.en?.file.url).toBe(
        `http://localhost:3000/files/${english.id}`,
      );
      expect(assignments.en?.file).not.toHaveProperty('data');
    });

    it('returns both languages once both are assigned', async () => {
      await service.assign('en', english.id);
      await service.assign('es', spanish.id);

      await expect(service.assignments()).resolves.toEqual({
        en: { file: english, assignedAt: expect.any(Date) },
        es: { file: spanish, assignedAt: expect.any(Date) },
      });
    });
  });

  describe('assign (U-S2)', () => {
    it('creates the assignment and returns every language', async () => {
      await expect(service.assign('en', english.id)).resolves.toEqual({
        en: { file: english, assignedAt: expect.any(Date) },
        es: null,
      });
      expect(prisma.resume.rows).toEqual([
        { lang: 'en', fileId: english.id, assignedAt: expect.any(Date) },
      ]);
    });

    it('replaces the file, keeps the previous one and updates the date', async () => {
      vi.useFakeTimers({ now: new Date('2026-01-01T00:00:00Z') });
      await service.assign('en', english.id);
      vi.setSystemTime(new Date('2026-02-01T00:00:00Z'));

      const result = await service.assign('en', spanish.id);

      expect(result.en).toEqual({
        file: spanish,
        assignedAt: new Date('2026-02-01T00:00:00Z'),
      });
      expect(prisma.resume.rows).toHaveLength(1);
      expect(prisma.file.rows.map((row) => row.id)).toContain(english.id);
    });

    it('writes nothing when the current file is assigned again', async () => {
      vi.useFakeTimers({ now: new Date('2026-01-01T00:00:00Z') });
      await service.assign('en', english.id);
      vi.setSystemTime(new Date('2026-02-01T00:00:00Z'));
      const upsert = vi.spyOn(prisma.resume, 'upsert');

      const result = await service.assign('en', english.id);

      expect(result.en?.assignedAt).toEqual(new Date('2026-01-01T00:00:00Z'));
      expect(upsert).not.toHaveBeenCalled();
    });
  });

  describe('assign errors (U-S3, U-S4)', () => {
    beforeEach(async () => {
      await service.assign('en', english.id);
    });

    it('answers 404 for a missing file and keeps the assignment', async () => {
      await expect(service.assign('en', UNKNOWN_ID)).rejects.toEqual(
        new NotFoundException('Not found.'),
      );
      expect(prisma.resume.rows).toMatchObject([{ fileId: english.id }]);
    });

    it('answers 400 with a fileId error for an image and keeps the assignment', async () => {
      const image = await files.store('photo.png', samples.png);

      const call = service.assign('en', image.id);

      await expect(call).rejects.toBeInstanceOf(BadRequestException);
      await expect(call).rejects.toMatchObject({
        response: { fields: { fileId: [expect.any(String)] } },
      });
      expect(prisma.resume.rows).toMatchObject([{ fileId: english.id }]);
    });

    it('answers 409 to a Spanish resume without an English one and creates nothing', async () => {
      prisma.resume.rows = [];

      await expect(service.assign('es', spanish.id)).rejects.toBeInstanceOf(
        ConflictException,
      );
      expect(prisma.resume.rows).toEqual([]);
    });
  });

  describe('clear (U-S5)', () => {
    it('removes the assignment and keeps the file', async () => {
      await service.assign('en', english.id);

      await service.clear('en');

      expect(prisma.resume.rows).toEqual([]);
      expect(prisma.file.rows.map((row) => row.id)).toContain(english.id);
    });

    it('does nothing for a language without a resume', async () => {
      await service.assign('en', english.id);

      await expect(service.clear('es')).resolves.toBeUndefined();
      expect(prisma.resume.rows).toHaveLength(1);
    });

    it('answers 409 to clearing English while Spanish is assigned', async () => {
      await service.assign('en', english.id);
      await service.assign('es', spanish.id);

      await expect(service.clear('en')).rejects.toBeInstanceOf(
        ConflictException,
      );
      expect(prisma.resume.rows).toHaveLength(2);
    });

    it('clears Spanish, then English', async () => {
      await service.assign('en', english.id);
      await service.assign('es', spanish.id);

      await service.clear('es');
      await service.clear('en');

      expect(prisma.resume.rows).toEqual([]);
    });
  });

  describe('publicFile (U-S6)', () => {
    const englishBytes = () => samples.pdf;
    const spanishBytes = () => Buffer.concat([samples.pdf, Buffer.from('es')]);

    it('serves each language its own file', async () => {
      await service.assign('en', english.id);
      await service.assign('es', spanish.id);

      await expect(service.publicFile('en')).resolves.toEqual({
        data: englishBytes(),
        mime: 'application/pdf',
        name: 'CV.pdf',
      });
      await expect(service.publicFile('es')).resolves.toEqual({
        data: spanishBytes(),
        mime: 'application/pdf',
        name: 'CV es.pdf',
      });
    });

    it('serves English without lang and for Spanish when none is assigned', async () => {
      await service.assign('en', english.id);

      await expect(service.publicFile()).resolves.toMatchObject({
        name: 'CV.pdf',
      });
      await expect(service.publicFile('es')).resolves.toMatchObject({
        name: 'CV.pdf',
      });
    });

    it('answers 404 when nothing is assigned', async () => {
      for (const lang of [undefined, 'en', 'es'] as const) {
        await expect(service.publicFile(lang)).rejects.toEqual(
          new NotFoundException('Not found.'),
        );
      }
    });

    it('serves only Spanish when Spanish was assigned without English with SQL', async () => {
      await prisma.resume.create({ data: { lang: 'es', fileId: spanish.id } });

      await expect(service.publicFile('es')).resolves.toMatchObject({
        name: 'CV es.pdf',
      });
      await expect(service.publicFile('en')).rejects.toBeInstanceOf(
        NotFoundException,
      );
    });
  });
});
