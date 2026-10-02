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
});
