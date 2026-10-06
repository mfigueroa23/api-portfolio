import {
  BadGatewayException,
  BadRequestException,
  Logger,
  NotFoundException,
} from '@nestjs/common';
import { Prisma } from '../../../generated/prisma/client.js';
import { PrismaFake } from '../../../../test/fakes/prisma.fake.js';
import { PrismaService } from '../../database/prisma.service.js';
import { MailService, MailUnavailableError } from '../../mail/mail.service.js';
import { CreateTestimonialDto } from './dto/testimonials.dto.js';
import { TestimonialsService } from './testimonials.service.js';

const item = {
  quote: 'Great work.',
  author: 'Grace Hopper',
  role: 'Admiral',
  avatar: 'https://api.figueroa-sanchez.com/files/grace',
} satisfies CreateTestimonialDto;

const submission = {
  name: 'Ada Lovelace',
  role: 'Engineer',
  email: 'ada@example.com',
  testimonial: 'A pleasure to work with.',
};

const PUBLIC_FIELDS = [
  'author',
  'avatar',
  'createdAt',
  'id',
  'lang',
  'position',
  'quote',
  'role',
  'updatedAt',
];

describe('TestimonialsService', () => {
  let prisma: PrismaFake;
  let service: TestimonialsService;
  const send = vi.fn();

  beforeEach(() => {
    vi.useFakeTimers({ now: new Date('2026-10-05T12:00:00Z') });
    prisma = new PrismaFake();
    send.mockReset().mockResolvedValue(undefined);
    service = new TestimonialsService(
      prisma as unknown as PrismaService,
      { send } as unknown as MailService,
    );
    vi.spyOn(Logger.prototype, 'warn').mockImplementation(() => undefined);
  });

  afterEach(() => {
    vi.useRealTimers();
    vi.restoreAllMocks();
  });

  // Seeds rows directly, like testimonials that existed before Spec 004.
  const seed = (data: Record<string, unknown>) =>
    prisma.testimonial.create({ data: { ...item, ...data } });

  const pending = (data: Record<string, unknown> = {}) =>
    seed({
      status: 'pending',
      position: null,
      email: 'visitor@example.com',
      language: 'en',
      submittedAt: new Date(),
      ...data,
    });

  const publicAuthors = async () =>
    (await service.listApproved()).map((row) => row.author);

  describe('listApproved', () => {
    it('lists approved items by position, then id, never pending ones', async () => {
      await seed({ author: 'c', position: 2 });
      await seed({ author: 'a', position: 0 });
      await pending({ author: 'pending' });
      await seed({ author: 'd', position: 2 });
      await seed({ author: 'b', position: 1 });

      expect(await publicAuthors()).toEqual(['a', 'b', 'c', 'd']);
    });

    it('returns only the public fields (no email or review data)', async () => {
      await seed({
        position: 0,
        email: 'kept@example.com',
        language: 'en',
        submittedAt: new Date(),
      });

      const [row] = await service.listApproved();

      expect(Object.keys(row).sort()).toEqual(PUBLIC_FIELDS);
    });

    it('lists an empty collection as an empty array', async () => {
      await expect(service.listApproved()).resolves.toEqual([]);
    });
  });

  describe('listAll', () => {
    it('lists pending items newest first, then approved ones by position', async () => {
      await seed({ author: 'approved-1', position: 1 });
      await pending({
        author: 'pending-old',
        submittedAt: new Date('2026-10-01T00:00:00Z'),
      });
      await seed({
        author: 'approved-0',
        position: 0,
        submittedAt: new Date('2026-10-04T00:00:00Z'),
      });
      await pending({
        author: 'pending-new',
        submittedAt: new Date('2026-10-03T00:00:00Z'),
      });

      const rows = await service.listAll();

      expect(rows.map((row) => row.author)).toEqual([
        'pending-new',
        'pending-old',
        'approved-0',
        'approved-1',
      ]);
      expect(rows[0]).toMatchObject({
        email: 'visitor@example.com',
        language: 'en',
        notified: true,
        status: 'pending',
      });
    });
  });

  describe('pendingCount', () => {
    it('counts only pending items', async () => {
      await seed({ position: 0 });
      await pending();
      await pending();

      await expect(service.pendingCount()).resolves.toEqual({ count: 2 });
    });
  });

  describe('create', () => {
    it('stores an approved item at position 0', async () => {
      const created = await service.create(item);

      expect(created).toMatchObject({
        id: 1,
        ...item,
        position: 0,
        status: 'approved',
      });
    });

    it('accepts an item without a photo', async () => {
      const { avatar: _avatar, ...withoutPhoto } = item;

      await expect(service.create(withoutPhoto)).resolves.toMatchObject({
        avatar: null,
      });
    });

    it('places the new item first and keeps the order of the others', async () => {
      await seed({ author: 'b', position: 0 });
      await seed({ author: 'c', position: 1 });
      await seed({ author: 'd', position: 5 });

      await service.create({ ...item, author: 'a' });

      expect(await publicAuthors()).toEqual(['a', 'b', 'c', 'd']);
      expect((await service.listApproved()).map((row) => row.position)).toEqual(
        [0, 1, 2, 6],
      );
    });

    it('does not move pending items', async () => {
      await pending();

      await service.create(item);

      expect(prisma.testimonial.rows[0].position).toBeNull();
    });
  });

  describe('update', () => {
    it('updates the values and keeps a pending item pending with its email', async () => {
      const row = await pending();

      const updated = await service.update(row.id, {
        ...item,
        quote: 'Fixed typo.',
      });

      expect(updated).toMatchObject({
        quote: 'Fixed typo.',
        status: 'pending',
        email: 'visitor@example.com',
      });
    });

    it('changes the position of an approved item when given', async () => {
      const row = await seed({ position: 0 });

      await expect(
        service.update(row.id, { ...item, position: 3 }),
      ).resolves.toMatchObject({ position: 3 });
      await expect(service.update(row.id, item)).resolves.toMatchObject({
        position: 3,
      });
    });

    it('never changes status or email even if they are sent', async () => {
      const row = await pending();

      await service.update(row.id, {
        ...item,
        status: 'approved',
        email: null,
      } as typeof item);

      expect(prisma.testimonial.rows[0]).toMatchObject({
        status: 'pending',
        email: 'visitor@example.com',
      });
    });

    it('stores an empty photo as null', async () => {
      const row = await seed({ position: 0 });

      await expect(
        service.update(row.id, { ...item, avatar: null }),
      ).resolves.toMatchObject({ avatar: null });
    });
  });

  describe('approve', () => {
    it('stores the form values, clears the email and makes it public first', async () => {
      await seed({ author: 'b', position: 0 });
      await seed({ author: 'c', position: 1 });
      const row = await pending();

      const approved = await service.approve(row.id, {
        ...item,
        author: 'a',
        quote: 'Edited before approval.',
      });

      expect(approved).toMatchObject({
        id: row.id,
        author: 'a',
        quote: 'Edited before approval.',
        status: 'approved',
        position: 0,
        email: null,
      });
      expect(await publicAuthors()).toEqual(['a', 'b', 'c']);
    });

    it('puts the last of two approvals in a row first', async () => {
      await seed({ author: 'old', position: 0 });
      const first = await pending({ author: 'first' });
      const second = await pending({ author: 'second' });

      await service.approve(first.id, { ...item, author: 'first' });
      await service.approve(second.id, { ...item, author: 'second' });

      expect(await publicAuthors()).toEqual(['second', 'first', 'old']);
    });

    it('keeps the owner order after a reorder until the next approval', async () => {
      const a = await seed({ author: 'a', position: 0 });
      await seed({ author: 'b', position: 1 });
      await service.update(a.id, { ...item, author: 'a', position: 2 });
      expect(await publicAuthors()).toEqual(['b', 'a']);

      const next = await pending({ author: 'new' });
      await service.approve(next.id, { ...item, author: 'new' });

      expect(await publicAuthors()).toEqual(['new', 'b', 'a']);
    });

    it('leaves an already approved item unchanged', async () => {
      await seed({ author: 'a', position: 0 });
      const b = await seed({ author: 'b', position: 1 });

      const result = await service.approve(b.id, { ...item, author: 'x' });

      expect(result).toMatchObject({ author: 'b', position: 1 });
      expect(await publicAuthors()).toEqual(['a', 'b']);
    });

    it('answers 404 when the item does not exist', async () => {
      await expect(service.approve(99, item)).rejects.toBeInstanceOf(
        NotFoundException,
      );
    });
  });

  describe('remove', () => {
    it('deletes the item with its email (reject)', async () => {
      const row = await pending();

      await service.remove(row.id);

      expect(prisma.testimonial.rows).toEqual([]);
    });

    it('rejects with P2025 when the item does not exist', async () => {
      await expect(service.update(99, item)).rejects.toBeInstanceOf(
        Prisma.PrismaClientKnownRequestError,
      );
      await expect(service.remove(99)).rejects.toMatchObject({
        code: 'P2025',
      });
    });
  });

  describe('submit', () => {
    it('stores a pending testimonial without position or photo', async () => {
      await service.submit(submission, 'en');

      expect(prisma.testimonial.rows).toEqual([
        expect.objectContaining({
          status: 'pending',
          position: null,
          avatar: null,
          author: 'Ada Lovelace',
          role: 'Engineer',
          quote: 'A pleasure to work with.',
          email: 'ada@example.com',
          language: 'en',
          notified: true,
          submittedAt: new Date('2026-10-05T12:00:00Z'),
        }),
      ]);
      expect(await service.listApproved()).toEqual([]);
    });

    it('notifies the owner as "Portfolio Testimonials" with the visitor as reply-to', async () => {
      await service.submit(submission, 'en');

      expect(send).toHaveBeenCalledTimes(1);
      expect(send).toHaveBeenCalledWith(
        expect.objectContaining({
          senderName: 'Portfolio Testimonials',
          replyTo: { name: 'Ada Lovelace', email: 'ada@example.com' },
          subject: 'New testimonial from Ada Lovelace',
        }),
      );
    });

    it.each([
      ['the provider credential is missing', new MailUnavailableError()],
      ['the provider fails', new BadGatewayException('down')],
      ['anything else fails', new Error('boom')],
    ])(
      'keeps the testimonial and marks it not notified when %s',
      async (_label, error) => {
        send.mockRejectedValue(error);

        await expect(service.submit(submission, 'en')).resolves.toBeUndefined();

        expect(prisma.testimonial.rows).toEqual([
          expect.objectContaining({ status: 'pending', notified: false }),
        ]);
      },
    );

    it('never logs the visitor email when the notification fails', async () => {
      const warn = vi.spyOn(Logger.prototype, 'warn');
      send.mockRejectedValue(new Error('ada@example.com rejected'));

      await service.submit(submission, 'en');

      expect(JSON.stringify(warn.mock.calls)).not.toContain('ada@example.com');
    });

    it('keeps pending testimonials until the owner acts (no expiry)', async () => {
      await service.submit(submission, 'en');
      vi.advanceTimersByTime(365 * 24 * 60 * 60 * 1000);

      await expect(service.pendingCount()).resolves.toEqual({ count: 1 });
    });
  });

  describe('Spanish (Spec 004 phase 3)', () => {
    const spanish = { quoteEs: 'Gran trabajo.', roleEs: 'Almirante' };

    it('lists approved items in Spanish only when fully translated', async () => {
      await seed({ author: 'a', position: 0, ...spanish });
      await seed({ author: 'b', position: 1, quoteEs: 'Solo la cita.' });

      const rows = await service.listApproved('es');

      expect(rows).toEqual([
        expect.objectContaining({
          author: 'a',
          quote: 'Gran trabajo.',
          role: 'Almirante',
          lang: 'es',
        }),
        expect.objectContaining({
          author: 'b',
          quote: 'Great work.',
          role: 'Admiral',
          lang: 'en',
        }),
      ]);
      for (const row of rows) {
        expect(row).not.toHaveProperty('quoteEs');
        expect(row).not.toHaveProperty('roleEs');
      }
    });

    it('lists English with lang "en" by default', async () => {
      await seed({ position: 0, ...spanish });

      expect(await service.listApproved()).toEqual([
        expect.objectContaining({ quote: 'Great work.', lang: 'en' }),
      ]);
    });

    it('marks each owner list item as translated or not', async () => {
      await seed({ author: 'a', position: 0, ...spanish });
      await seed({ author: 'b', position: 1 });

      expect(
        (await service.listAll()).map(({ author, translated }) => ({
          author,
          translated,
        })),
      ).toEqual([
        { author: 'a', translated: true },
        { author: 'b', translated: false },
      ]);
    });

    it('stores a Spanish submission as the Spanish role and quote', async () => {
      await service.submit(submission, 'es');

      expect(prisma.testimonial.rows).toEqual([
        expect.objectContaining({
          status: 'pending',
          language: 'es',
          role: null,
          quote: null,
          roleEs: 'Engineer',
          quoteEs: 'A pleasure to work with.',
        }),
      ]);
    });

    it('stores an English submission as the English role and quote', async () => {
      await service.submit(submission, 'en');

      expect(prisma.testimonial.rows[0]).toMatchObject({
        role: 'Engineer',
        quote: 'A pleasure to work with.',
        roleEs: null,
        quoteEs: null,
      });
    });

    it('writes the language line of the notification in English words', async () => {
      await service.submit(submission, 'es');

      const [[email]] = send.mock.calls as [[{ text: string; html: string }]];
      expect(email.text).toContain('Language: Spanish');
      expect(email.html).toContain('New Testimonial');
    });

    it('saves a pending Spanish submission without English text', async () => {
      const row = await pending({ quote: null, role: null, ...spanish });

      await expect(
        service.update(row.id, { author: 'Ana', ...spanish }),
      ).resolves.toMatchObject({ quote: null, status: 'pending' });
    });

    it('refuses to approve without the English quote and role', async () => {
      const row = await pending({ quote: null, role: null, ...spanish });

      const error = await service
        .approve(row.id, { author: 'Ana', ...spanish })
        .catch((e: unknown) => e);

      expect(error).toBeInstanceOf(BadRequestException);
      expect((error as BadRequestException).getResponse()).toMatchObject({
        error: 'Validation failed.',
        fields: { quote: expect.any(Array), role: expect.any(Array) },
      });
      expect(prisma.testimonial.rows[0]).toMatchObject({ status: 'pending' });
    });

    it('refuses to empty the English text of an approved item', async () => {
      const row = await seed({ position: 0 });

      await expect(
        service.update(row.id, { author: 'Ana', quote: null, role: 'R' }),
      ).rejects.toBeInstanceOf(BadRequestException);
      expect(prisma.testimonial.rows[0]).toMatchObject({
        quote: 'Great work.',
      });
    });

    it('approves with both language versions', async () => {
      const row = await pending({ quote: null, role: null });

      await expect(
        service.approve(row.id, { ...item, ...spanish }),
      ).resolves.toMatchObject({
        status: 'approved',
        quote: 'Great work.',
        quoteEs: 'Gran trabajo.',
        roleEs: 'Almirante',
      });
    });
  });
});
