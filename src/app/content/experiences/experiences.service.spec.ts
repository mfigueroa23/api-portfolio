import { Prisma } from '../../../generated/prisma/client.js';
import { PrismaFake } from '../../../../test/fakes/prisma.fake.js';
import { PrismaService } from '../../database/prisma.service.js';
import { MarkdownService } from '../../markdown/markdown.service.js';
import { ExperienceDto } from './dto/experiences.dto.js';
import { ExperiencesService } from './experiences.service.js';

const item = {
  period: 'Jan 2026 — Present',
  role: 'Engineer',
  company: 'Acme',
  description: 'Builds things.',
  technologies: ['TypeScript', 'NestJS'],
  current: true,
  startDate: '2026-01',
  body: 'Shipped **things**.',
} satisfies ExperienceDto;

describe('ExperiencesService', () => {
  let prisma: PrismaFake;
  let service: ExperiencesService;

  beforeEach(() => {
    prisma = new PrismaFake();
    service = new ExperiencesService(
      prisma as unknown as PrismaService,
      new MarkdownService(),
    );
  });

  it('lists current entries first, then by start date, undated last', async () => {
    const rows: [boolean, string | null][] = [
      [false, '2020-01-01'],
      [false, null],
      [true, '2023-05-01'],
      [false, '2024-03-01'],
      [true, null],
      [false, '2024-03-01'],
      [true, '2025-01-01'],
    ];
    for (const [current, startDate] of rows) {
      await prisma.experience.create({
        data: {
          ...item,
          current,
          startDate: startDate ? new Date(startDate) : null,
        },
      });
    }

    expect((await service.list()).map((row) => row.id)).toEqual([
      7, 3, 5, 4, 6, 1, 2,
    ]);
  });

  it('lists an empty collection as an empty array', async () => {
    await expect(service.list()).resolves.toEqual([]);
  });

  it('creates and returns the stored item', async () => {
    const created = await service.create(item);

    expect(created).toMatchObject({ id: 1, ...item });
    expect(await service.list()).toHaveLength(1);
  });

  it('stores the start month as its first day and returns it as YYYY-MM', async () => {
    const created = await service.create({ ...item, startDate: '2024-12' });

    expect(prisma.experience.rows[0].startDate).toEqual(
      new Date('2024-12-01T00:00:00Z'),
    );
    expect(created.startDate).toBe('2024-12');
  });

  it('lists entries with their rendered body', async () => {
    await service.create(item);
    await service.create({ ...item, body: null });

    const [first, second] = await service.list();

    expect(first).toMatchObject({
      body: item.body,
      bodyHtml: '<p>Shipped <strong>things</strong>.</p>\n',
    });
    expect(second).toMatchObject({ body: null, bodyHtml: '' });
  });

  it('returns a missing start date as null', async () => {
    await prisma.experience.create({ data: { ...item, startDate: null } });

    expect((await service.list())[0].startDate).toBeNull();
  });

  it('updates an existing item', async () => {
    const created = await service.create(item);

    const updated = await service.update(created.id, {
      ...item,
      period: 'Updated',
    });

    expect(updated).toMatchObject({ id: created.id, period: 'Updated' });
    expect((await service.list())[0]).toMatchObject({ period: 'Updated' });
  });

  it('removes an existing item', async () => {
    const created = await service.create(item);

    await service.remove(created.id);

    expect(await service.list()).toEqual([]);
  });

  it('rejects with P2025 when the item does not exist', async () => {
    await expect(service.update(99, item)).rejects.toBeInstanceOf(
      Prisma.PrismaClientKnownRequestError,
    );
    await expect(service.remove(99)).rejects.toMatchObject({ code: 'P2025' });
  });
});
