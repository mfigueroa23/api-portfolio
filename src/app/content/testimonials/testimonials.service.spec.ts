import { Prisma } from '../../../generated/prisma/client.js';
import { PrismaFake } from '../../../../test/fakes/prisma.fake.js';
import { PrismaService } from '../../database/prisma.service.js';
import { TestimonialDto } from './dto/testimonials.dto.js';
import { TestimonialsService } from './testimonials.service.js';

const item = {
  position: 0,
  quote: 'Great work.',
  author: 'Grace Hopper',
  role: 'Admiral',
  avatar: '/avatars/grace.png',
} satisfies TestimonialDto;

describe('TestimonialsService', () => {
  let prisma: PrismaFake;
  let service: TestimonialsService;

  beforeEach(() => {
    prisma = new PrismaFake();
    service = new TestimonialsService(prisma as unknown as PrismaService);
  });

  it('lists items ordered by position, then id', async () => {
    for (const position of [2, 0, 2, 1]) {
      await service.create({ ...item, position });
    }

    expect((await service.list()).map((row) => row.id)).toEqual([2, 4, 1, 3]);
  });

  it('lists an empty collection as an empty array', async () => {
    await expect(service.list()).resolves.toEqual([]);
  });

  it('creates and returns the stored item', async () => {
    const created = await service.create(item);

    expect(created).toMatchObject({ id: 1, ...item });
    expect(await service.list()).toHaveLength(1);
  });

  it('updates an existing item', async () => {
    const created = await service.create(item);

    const updated = await service.update(created.id, {
      ...item,
      quote: 'Updated',
    });

    expect(updated).toMatchObject({ id: created.id, quote: 'Updated' });
    expect((await service.list())[0]).toMatchObject({ quote: 'Updated' });
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
