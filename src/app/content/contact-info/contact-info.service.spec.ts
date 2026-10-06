import { Prisma } from '../../../generated/prisma/client.js';
import { PrismaFake } from '../../../../test/fakes/prisma.fake.js';
import { PrismaService } from '../../database/prisma.service.js';
import { ContactInfoDto } from './dto/contact-info.dto.js';
import { ContactInfoService } from './contact-info.service.js';

const item = {
  position: 0,
  icon: 'fa-solid fa-envelope',
  label: 'Email',
  value: 'me@example.com',
  href: 'mailto:me@example.com',
} satisfies ContactInfoDto;

describe('ContactInfoService', () => {
  let prisma: PrismaFake;
  let service: ContactInfoService;

  beforeEach(() => {
    prisma = new PrismaFake();
    service = new ContactInfoService(prisma as unknown as PrismaService);
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
      icon: 'Updated',
    });

    expect(updated).toMatchObject({ id: created.id, icon: 'Updated' });
    expect((await service.list())[0]).toMatchObject({ icon: 'Updated' });
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

  describe('Spanish (Spec 004 phase 3)', () => {
    const spanish = { labelEs: 'Correo' };

    it('stores the Spanish versions and empties them on replace', async () => {
      const created = await service.create({ ...item, ...spanish });
      expect(created).toMatchObject(spanish);

      const updated = await service.update(created.id, item);
      for (const key of ['labelEs']) {
        expect((updated as Record<string, unknown>)[key]).toBeNull();
      }
    });

    it('lists a translated item in Spanish with lang "es"', async () => {
      await service.create({ ...item, ...spanish });

      const [row] = await service.list('es');

      expect(row).toMatchObject({
        label: 'Correo',
        value: 'me@example.com',
        lang: 'es',
      });
      for (const key of ['labelEs']) expect(row).not.toHaveProperty(key);
    });

    it('lists English with lang "en" by default', async () => {
      await service.create({ ...item, ...spanish });

      expect((await service.list())[0]).toMatchObject({
        label: 'Email',
        lang: 'en',
      });
    });

    it('lists every item for the owner with its Spanish fields and translated flag', async () => {
      await service.create({ ...item, ...spanish });
      await service.create(item);

      const rows = await service.listAll();

      expect(rows.map((row) => row.translated)).toEqual([true, false]);
      expect(rows[0]).toMatchObject(spanish);
    });
  });
});
