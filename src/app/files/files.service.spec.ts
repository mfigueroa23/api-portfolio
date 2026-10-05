import { BadRequestException, NotFoundException } from '@nestjs/common';
import { PrismaFake } from '../../../test/fakes/prisma.fake.js';
import { samples } from '../../../test/fixtures/file-samples.js';
import { TOO_LARGE } from '../common/middlewares/raw-body.middleware.js';
import { PrismaService } from '../database/prisma.service.js';
import { FilesService } from './files.service.js';

const MIB = 1024 * 1024;

// A body of `size` bytes that starts with the given signature.
function sized(signature: Buffer, size: number): Buffer {
  const bytes = Buffer.alloc(size, 0x20);
  signature.copy(bytes);
  return bytes;
}

describe('FilesService', () => {
  let prisma: PrismaFake;
  let service: FilesService;

  beforeEach(() => {
    vi.stubEnv('API_PUBLIC_URL', 'http://localhost:3000/');
    prisma = new PrismaFake();
    service = new FilesService(prisma as unknown as PrismaService);
  });

  afterEach(() => {
    vi.unstubAllEnvs();
  });

  describe('store', () => {
    it('stores the bytes and returns the metadata with the public URL', async () => {
      const stored = await service.store('diagram.png', samples.png);

      expect(stored).toEqual({
        id: expect.any(String),
        name: 'diagram.png',
        mime: 'image/png',
        size: samples.png.length,
        createdAt: expect.any(Date),
        url: `http://localhost:3000/files/${stored.id}`,
      });
      expect(Buffer.from(prisma.file.rows[0].data)).toEqual(samples.png);
    });

    it('builds URLs on the production API host by default', async () => {
      vi.stubEnv('API_PUBLIC_URL', undefined);

      const stored = await service.store('a.pdf', samples.pdf);

      expect(stored.url).toBe(
        `https://api.figueroa-sanchez.com/files/${stored.id}`,
      );
    });

    it('gives two uploads of the same file different ids', async () => {
      const first = await service.store('a.png', samples.png);
      const second = await service.store('a.png', samples.png);

      expect(first.id).not.toBe(second.id);
    });

    it('takes the type from the content, never from the name', async () => {
      await expect(
        service.store('photo.png', samples.pdf),
      ).resolves.toMatchObject({ mime: 'application/pdf' });
      await expect(service.store('photo.png', samples.text)).rejects.toEqual(
        new BadRequestException('Unsupported file type.'),
      );
    });

    it('accepts an image of exactly 5 MiB and refuses one byte more', async () => {
      await expect(
        service.store('big.png', sized(samples.png, 5 * MIB)),
      ).resolves.toMatchObject({ size: 5 * MIB });
      await expect(
        service.store('big.png', sized(samples.png, 5 * MIB + 1)),
      ).rejects.toEqual(new BadRequestException('File too large.'));
    });

    it('accepts a PDF of exactly 10 MiB', async () => {
      await expect(
        service.store('big.pdf', sized(samples.pdf, 10 * MIB)),
      ).resolves.toMatchObject({ size: 10 * MIB, mime: 'application/pdf' });
    });

    it('refuses a body marked too large by the raw body reader', async () => {
      await expect(service.store('huge.pdf', TOO_LARGE)).rejects.toEqual(
        new BadRequestException('File too large.'),
      );
      expect(prisma.file.rows).toEqual([]);
    });

    it('keeps the first 200 characters of the name', async () => {
      const name = `${'é'.repeat(199)}🚀🚀.png`;

      const stored = await service.store(name, samples.png);

      expect(stored.name).toBe(`${'é'.repeat(199)}🚀`);
      expect(Array.from(stored.name)).toHaveLength(200);
    });
  });

  describe('list', () => {
    async function seed(count: number, sample: Buffer, start: number) {
      for (let index = 0; index < count; index++) {
        const stored = await service.store(`f${start + index}`, sample);
        const row = prisma.file.rows.find((file) => file.id === stored.id)!;
        row.createdAt = new Date(Date.UTC(2026, 0, 1, 0, 0, start + index));
      }
    }

    it('pages 50 files newest first without their bytes', async () => {
      await seed(51, samples.png, 0);
      await seed(10, samples.pdf, 100);

      const first = await service.list(1);
      const second = await service.list(2);

      expect(first).toMatchObject({ page: 1, totalPages: 2, total: 61 });
      expect(first.items).toHaveLength(50);
      expect(first.items[0]).toMatchObject({ name: 'f109' });
      expect(first.items[0].url).toMatch(/^http:\/\/localhost:3000\/files\//);
      expect(first.items[0]).not.toHaveProperty('data');
      expect(second.items.map((file) => file.name)).toEqual([
        'f10',
        'f9',
        'f8',
        'f7',
        'f6',
        'f5',
        'f4',
        'f3',
        'f2',
        'f1',
        'f0',
      ]);
    });

    it('filters by images or PDF', async () => {
      await seed(2, samples.png, 0);
      await seed(1, samples.svg, 2);
      await seed(3, samples.pdf, 3);

      const images = await service.list(1, 'image');
      const pdfs = await service.list(1, 'pdf');

      expect(images.items.map((file) => file.name)).toEqual(['f2', 'f1', 'f0']);
      expect(images.total).toBe(3);
      expect(pdfs.items.map((file) => file.mime)).toEqual([
        'application/pdf',
        'application/pdf',
        'application/pdf',
      ]);
    });

    it('answers an empty library with no pages', async () => {
      await expect(service.list(1)).resolves.toEqual({
        items: [],
        page: 1,
        totalPages: 0,
        total: 0,
      });
    });
  });

  describe('read and remove', () => {
    it('reads the bytes, type and name of a file', async () => {
      const stored = await service.store('a.svg', samples.svg);

      await expect(service.read(stored.id)).resolves.toEqual({
        data: samples.svg,
        mime: 'image/svg+xml',
        name: 'a.svg',
      });
    });

    it.each(['2b1e0a4c-5d3f-4e2a-9b8c-7d6e5f4a3b2c', 'not-a-uuid'])(
      'answers 404 for an unknown id (%s)',
      async (id) => {
        await expect(service.read(id)).rejects.toEqual(
          new NotFoundException('Not found.'),
        );
        await expect(service.remove(id)).rejects.toEqual(
          new NotFoundException('Not found.'),
        );
      },
    );

    it('deletes a file', async () => {
      const stored = await service.store('a.png', samples.png);

      await service.remove(stored.id);

      expect(prisma.file.rows).toEqual([]);
      await expect(service.read(stored.id)).rejects.toBeInstanceOf(
        NotFoundException,
      );
    });
  });
});
