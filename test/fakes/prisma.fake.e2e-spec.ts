import { Prisma } from '../../src/generated/prisma/client.js';
import { PrismaFake } from './prisma.fake.js';

describe('PrismaFake', () => {
  let prisma: PrismaFake;

  beforeEach(() => {
    prisma = new PrismaFake();
  });

  it('assigns ids and timestamps on create', async () => {
    const row = await prisma.technology.create({
      data: { position: 0, name: 'Angular' },
    });

    expect(row).toMatchObject({ id: 1, position: 0, name: 'Angular' });
    expect(row.createdAt).toBeInstanceOf(Date);
    expect(row.updatedAt).toBeInstanceOf(Date);
  });

  it('sorts findMany by every orderBy field in turn', async () => {
    await prisma.technology.create({ data: { position: 2, name: 'c' } });
    await prisma.technology.create({ data: { position: 1, name: 'b' } });
    await prisma.technology.create({ data: { position: 1, name: 'a' } });

    const rows = await prisma.technology.findMany({
      orderBy: [{ position: 'asc' }, { id: 'asc' }],
    });

    expect(rows.map((row) => row.id)).toEqual([2, 3, 1]);
  });

  it('finds rows by a unique key that is not the id', async () => {
    await prisma.property.create({ data: { key: 'jwt_secret', value: 's' } });

    expect(
      await prisma.property.findUnique({ where: { key: 'jwt_secret' } }),
    ).toMatchObject({ key: 'jwt_secret', value: 's' });
    expect(
      await prisma.property.findUnique({ where: { key: 'missing' } }),
    ).toBeNull();
  });

  it('updates and deletes existing rows', async () => {
    const row = await prisma.technology.create({
      data: { position: 0, name: 'old' },
    });

    await prisma.technology.update({
      where: { id: row.id },
      data: { name: 'new' },
    });
    expect(await prisma.technology.findMany()).toMatchObject([{ name: 'new' }]);

    await prisma.technology.delete({ where: { id: row.id } });
    expect(await prisma.technology.findMany()).toEqual([]);
  });

  it.each(['update', 'delete'] as const)(
    'throws P2025 on %s of a missing row',
    async (method) => {
      const call =
        method === 'update'
          ? prisma.technology.update({ where: { id: 99 }, data: {} })
          : prisma.technology.delete({ where: { id: 99 } });

      await expect(call).rejects.toBeInstanceOf(
        Prisma.PrismaClientKnownRequestError,
      );
      await expect(call).rejects.toMatchObject({ code: 'P2025' });
    },
  );

  it('counts and deletes rows filtered by equality and createdAt.lt', async () => {
    vi.useFakeTimers({ now: new Date('2026-01-01T00:00:00Z') });
    await prisma.rateLimitHit.create({ data: { bucket: 'contact', ip: '1' } });
    vi.setSystemTime(new Date('2026-01-01T02:00:00Z'));
    await prisma.rateLimitHit.create({ data: { bucket: 'contact', ip: '1' } });
    await prisma.rateLimitHit.create({ data: { bucket: 'login', ip: '1' } });
    vi.useRealTimers();

    const removed = await prisma.rateLimitHit.deleteMany({
      where: {
        bucket: 'contact',
        ip: '1',
        createdAt: { lt: new Date('2026-01-01T01:00:00Z') },
      },
    });

    expect(removed).toEqual({ count: 1 });
    expect(
      await prisma.rateLimitHit.count({
        where: { bucket: 'contact', ip: '1' },
      }),
    ).toBe(1);
    expect(await prisma.rateLimitHit.count()).toBe(2);
  });

  it('runs interactive transactions against itself', async () => {
    const result = await prisma.$transaction((tx) =>
      tx.technology.create({ data: { position: 0, name: 'x' } }),
    );

    expect(result).toMatchObject({ id: 1 });
  });

  it('stores certifications, posts and files, giving files UUID ids', async () => {
    const certification = await prisma.certification.create({
      data: { position: 0, name: 'AWS', issuer: 'Amazon' },
    });
    const post = await prisma.post.create({
      data: { slug: 'hello', title: 'Hello' },
    });
    const file = await prisma.file.create({
      data: { name: 'a.png', mime: 'image/png', size: 1, data: Buffer.of(1) },
    });

    expect(certification).toMatchObject({ id: 1 });
    expect(post).toMatchObject({ id: 1 });
    expect(file.id).toMatch(
      /^[0-9a-f]{8}-[0-9a-f]{4}-4[0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/,
    );
    expect(file.createdAt).toBeInstanceOf(Date);
    expect(file).not.toHaveProperty('updatedAt');
    expect(
      await prisma.file.findUnique({ where: { id: file.id } }),
    ).toMatchObject({ name: 'a.png' });
  });

  it.each(['project', 'post'] as const)(
    'raises P2002 with meta.target when a %s slug is reused',
    async (model) => {
      const first = await prisma[model].create({
        data: { slug: 'taken', title: 'A' },
      });
      const other = await prisma[model].create({
        data: { slug: 'free', title: 'B' },
      });

      const duplicateCreate = prisma[model].create({
        data: { slug: 'taken', title: 'C' },
      });
      const duplicateUpdate = prisma[model].update({
        where: { id: other.id },
        data: { slug: 'taken' },
      });

      for (const call of [duplicateCreate, duplicateUpdate]) {
        await expect(call).rejects.toBeInstanceOf(
          Prisma.PrismaClientKnownRequestError,
        );
        await expect(call).rejects.toMatchObject({
          code: 'P2002',
          meta: { target: ['slug'] },
        });
      }
      // Updating a row with its own slug is not a conflict.
      await expect(
        prisma[model].update({
          where: { id: first.id },
          data: { slug: 'taken', title: 'A2' },
        }),
      ).resolves.toMatchObject({ slug: 'taken', title: 'A2' });
      expect(await prisma[model].count()).toBe(2);
      expect(
        (await prisma[model].findUnique({ where: { id: other.id } }))?.slug,
      ).toBe('free');
    },
  );

  it('filters with has, in and not', async () => {
    await prisma.post.create({
      data: {
        slug: 'a',
        title: 'A',
        tagKeys: ['angular', 'web'],
        status: 'published',
      },
    });
    await prisma.post.create({
      data: { slug: 'b', title: 'B', tagKeys: ['web'], status: 'draft' },
    });
    await prisma.post.create({
      data: {
        slug: 'c',
        title: 'C',
        tagKeys: [],
        status: 'published',
        publishedAt: null,
      },
    });

    const slugs = async (where: Record<string, unknown>) =>
      (await prisma.post.findMany({ where })).map((row) => row.slug);

    expect(await slugs({ tagKeys: { has: 'web' } })).toEqual(['a', 'b']);
    expect(await slugs({ slug: { in: ['a', 'c', 'z'] } })).toEqual(['a', 'c']);
    expect(await slugs({ id: { not: 1 } })).toEqual(['b', 'c']);
    expect(
      await slugs({ status: 'published', tagKeys: { has: 'web' } }),
    ).toEqual(['a']);
    expect(await slugs({ publishedAt: { not: null } })).toEqual([]);
    expect(
      await prisma.post.count({ where: { tagKeys: { has: 'web' } } }),
    ).toBe(2);
  });

  it('pages findMany with skip and take after sorting', async () => {
    for (const name of ['a', 'b', 'c', 'd', 'e']) {
      await prisma.technology.create({ data: { position: 0, name } });
    }

    const rows = await prisma.technology.findMany({
      orderBy: { id: 'desc' },
      skip: 1,
      take: 2,
    });

    expect(rows.map((row) => row.name)).toEqual(['d', 'c']);
    expect(
      await prisma.technology.findMany({ take: 10, skip: 4 }),
    ).toHaveLength(1);
  });

  it('leaves omitted fields out of the returned rows', async () => {
    const file = await prisma.file.create({
      data: {
        name: 'a.pdf',
        mime: 'application/pdf',
        size: 1,
        data: Buffer.of(1),
      },
    });

    const [listed] = await prisma.file.findMany({ omit: { data: true } });
    const created = await prisma.file.create({
      data: {
        name: 'b.pdf',
        mime: 'application/pdf',
        size: 1,
        data: Buffer.of(2),
      },
      omit: { data: true },
    });

    expect(listed).toMatchObject({ id: file.id, name: 'a.pdf' });
    expect(listed).not.toHaveProperty('data');
    expect(created).not.toHaveProperty('data');
    expect(
      await prisma.file.findUnique({
        where: { id: file.id },
        omit: { data: true },
      }),
    ).not.toHaveProperty('data');
  });

  it('sorts nulls last when asked and like PostgreSQL otherwise', async () => {
    const dates = [null, '2024-01-01', null, '2025-01-01'];
    for (const date of dates) {
      await prisma.experience.create({
        data: { startDate: date ? new Date(date) : null },
      });
    }

    const ids = async (orderBy: unknown) =>
      (
        await prisma.experience.findMany({
          orderBy: orderBy as never,
        })
      ).map((row) => row.id);

    expect(
      await ids([
        { startDate: { sort: 'desc', nulls: 'last' } },
        { id: 'asc' },
      ]),
    ).toEqual([4, 2, 1, 3]);
    expect(
      await ids([
        { startDate: { sort: 'asc', nulls: 'first' } },
        { id: 'asc' },
      ]),
    ).toEqual([1, 3, 2, 4]);
    // PostgreSQL puts nulls first in descending order and last in ascending.
    expect(await ids([{ startDate: 'desc' }, { id: 'asc' }])).toEqual([
      1, 3, 4, 2,
    ]);
    expect(await ids([{ startDate: 'asc' }, { id: 'asc' }])).toEqual([
      2, 4, 1, 3,
    ]);
  });
});
