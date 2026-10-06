import {
  BadRequestException,
  ConflictException,
  NotFoundException,
} from '@nestjs/common';
import { PrismaFake } from '../../../../test/fakes/prisma.fake.js';
import { PrismaService } from '../../database/prisma.service.js';
import { MarkdownService } from '../../markdown/markdown.service.js';
import { PostDto } from './dto/post.dto.js';
import { normalizeTags, PostsService } from './posts.service.js';

const words = (count: number) =>
  Array.from({ length: count }, () => 'word').join(' ');

const complete = {
  title: 'Serving uploads from Postgres',
  slug: 'uploads',
  summary: 'Why files live in the database.',
  coverUrl: 'https://api.figueroa-sanchez.com/files/1',
  tags: ['Postgres', 'NestJS'],
  body: `## Why\n\n${words(250)}\n\n## How\n\n### Details\n\nText.`,
  references: [{ title: 'Docs', url: 'https://www.postgresql.org/docs/' }],
} satisfies PostDto;

describe('normalizeTags', () => {
  it('trims tags, dedupes them ignoring case and derives the keys', () => {
    expect(
      normalizeTags([' Angular ', 'angular', 'Web  Dev', 'web dev', '  ']),
    ).toEqual({
      tags: ['Angular', 'Web  Dev'],
      tagKeys: ['angular', 'web-dev'],
    });
  });

  it('handles a missing list', () => {
    expect(normalizeTags(undefined)).toEqual({ tags: [], tagKeys: [] });
  });
});

describe('PostsService', () => {
  let prisma: PrismaFake;
  let service: PostsService;

  beforeEach(() => {
    prisma = new PrismaFake();
    service = new PostsService(
      prisma as unknown as PrismaService,
      new MarkdownService(),
    );
  });

  afterEach(() => {
    vi.useRealTimers();
  });

  async function publishedAt(dto: PostDto, iso: string) {
    const created = await service.create(dto);
    vi.useFakeTimers({ now: new Date(iso), toFake: ['Date'] });
    const post = await service.publish(created.id);
    vi.useRealTimers();
    return post;
  }

  // n published posts, one per day of January 2026 (post-1 oldest).
  async function seedPublished(n: number, extra: Partial<PostDto> = {}) {
    for (let index = 1; index <= n; index++) {
      await publishedAt(
        { ...complete, ...extra, slug: `post-${index}` },
        new Date(Date.UTC(2026, 0, index)).toISOString(),
      );
    }
  }

  describe('writes', () => {
    it('stores a new post as a draft with normalised tags', async () => {
      const created = await service.create({
        ...complete,
        tags: ['Angular', ' angular ', 'Web Dev'],
      });

      expect(created).toMatchObject({
        status: 'draft',
        publishedAt: null,
        tags: ['Angular', 'Web Dev'],
        tagKeys: ['angular', 'web-dev'],
        references: complete.references,
      });
    });

    it('saves a draft with only title and slug', async () => {
      await expect(
        service.create({ title: 'T', slug: 't' }),
      ).resolves.toMatchObject({
        summary: null,
        coverUrl: null,
        body: null,
        tags: [],
        references: [],
      });
    });

    it('answers 409 for a slug used by another post', async () => {
      await service.create(complete);
      const other = await service.create({ ...complete, slug: 'other' });

      await expect(service.create(complete)).rejects.toBeInstanceOf(
        ConflictException,
      );
      await expect(service.update(other.id, complete)).rejects.toBeInstanceOf(
        ConflictException,
      );
    });

    it('requires title, slug, summary and body to publish', async () => {
      const created = await service.create({ title: 'T', slug: 't' });

      const error = await service
        .publish(created.id)
        .catch((caught: unknown) => caught);

      expect(error).toBeInstanceOf(BadRequestException);
      expect(
        Object.keys(
          ((error as BadRequestException).getResponse() as { fields: object })
            .fields,
        ),
      ).toEqual(['summary', 'body']);
    });

    it('keeps summary and body required while published', async () => {
      const post = await publishedAt(complete, '2026-01-01T00:00:00Z');

      await expect(
        service.update(post.id, { ...complete, summary: null }),
      ).rejects.toBeInstanceOf(BadRequestException);
    });

    it('keeps the first publication date when republished', async () => {
      const post = await publishedAt(complete, '2026-01-01T00:00:00Z');
      const draft = await service.unpublish(post.id);
      vi.useFakeTimers({
        now: new Date('2026-05-01T00:00:00Z'),
        toFake: ['Date'],
      });

      const republished = await service.publish(post.id);

      expect(draft).toMatchObject({
        status: 'draft',
        publishedAt: new Date('2026-01-01T00:00:00Z'),
      });
      expect(republished.publishedAt).toEqual(new Date('2026-01-01T00:00:00Z'));
    });

    it('removes a post and answers 404 for missing ones', async () => {
      const created = await service.create(complete);

      await service.remove(created.id);

      expect(prisma.post.rows).toEqual([]);
      await expect(service.update(99, complete)).rejects.toBeInstanceOf(
        NotFoundException,
      );
      await expect(service.publish(99)).rejects.toBeInstanceOf(
        NotFoundException,
      );
      await expect(service.unpublish(99)).rejects.toMatchObject({
        code: 'P2025',
      });
      await expect(service.remove(99)).rejects.toMatchObject({ code: 'P2025' });
    });
  });

  describe('reads', () => {
    it('pages published posts by 10, newest first', async () => {
      await seedPublished(11);
      await service.create({ ...complete, slug: 'draft' });

      const first = await service.listPublished({ page: 1 });
      const second = await service.listPublished({ page: 2 });

      expect(first).toMatchObject({
        page: 1,
        totalPages: 2,
        total: 11,
        tag: null,
      });
      expect(first.items.map((post) => post.slug)).toEqual(
        Array.from({ length: 10 }, (_, index) => `post-${11 - index}`),
      );
      expect(second.items.map((post) => post.slug)).toEqual(['post-1']);
    });

    it('gives list items their reading time but not their body', async () => {
      await seedPublished(1);

      const [item] = (await service.listPublished({ page: 1 })).items;

      expect(item).toMatchObject({
        slug: 'post-1',
        summary: complete.summary,
        tags: complete.tags,
        readingMinutes: 2,
      });
      expect(item).not.toHaveProperty('body');
    });

    it('answers 404 for a page beyond the last', async () => {
      await seedPublished(11);

      await expect(service.listPublished({ page: 3 })).rejects.toEqual(
        new NotFoundException('Not found.'),
      );
    });

    it('answers an empty first page when nothing is published', async () => {
      await service.create(complete);

      await expect(service.listPublished({ page: 1 })).resolves.toEqual({
        items: [],
        page: 1,
        totalPages: 0,
        total: 0,
        tag: null,
      });
      await expect(service.listPublished({ page: 2 })).rejects.toBeInstanceOf(
        NotFoundException,
      );
    });

    it('filters by tag key ignoring case and returns the display name', async () => {
      await seedPublished(2);
      await publishedAt(
        { ...complete, slug: 'web', tags: ['Web Dev'] },
        '2026-02-01T00:00:00Z',
      );

      const byKey = await service.listPublished({ page: 1, tag: 'web-dev' });
      const byCase = await service.listPublished({ page: 1, tag: 'Web-Dev' });

      expect(byKey).toMatchObject({ total: 1, tag: 'Web Dev' });
      expect(byKey.items.map((post) => post.slug)).toEqual(['web']);
      expect(byCase.items.map((post) => post.slug)).toEqual(['web']);
    });

    it('answers 404 for a tag without published posts', async () => {
      await service.create({ ...complete, tags: ['Hidden'] });

      await expect(
        service.listPublished({ page: 1, tag: 'hidden' }),
      ).rejects.toBeInstanceOf(NotFoundException);
    });

    it('feeds the 20 most recent published posts', async () => {
      await seedPublished(22);
      await service.create({ ...complete, slug: 'draft' });

      const feed = await service.feed();

      expect(feed).toHaveLength(20);
      expect(feed[0]).toMatchObject({ slug: 'post-22', readingMinutes: 2 });
      expect(feed[19].slug).toBe('post-3');
      expect(feed[0]).not.toHaveProperty('body');
    });

    it('lists every post for the owner, drafts first', async () => {
      await seedPublished(2);
      await service.create({ ...complete, slug: 'draft' });

      expect((await service.listAll()).map((post) => post.slug)).toEqual([
        'draft',
        'post-2',
        'post-1',
      ]);
    });

    it('returns a published post with html, toc, reading time and references', async () => {
      await seedPublished(1);

      await expect(
        service.findPublishedBySlug('post-1'),
      ).resolves.toMatchObject({
        slug: 'post-1',
        body: complete.body,
        bodyHtml: expect.stringContaining('<h2 id="why">Why</h2>'),
        toc: [
          { level: 2, text: 'Why', id: 'why' },
          { level: 2, text: 'How', id: 'how' },
          { level: 3, text: 'Details', id: 'details' },
        ],
        readingMinutes: 2,
        references: complete.references,
      });
    });

    it('answers 404 for a draft or unknown slug', async () => {
      await service.create({ ...complete, slug: 'draft' });

      for (const slug of ['draft', 'missing']) {
        await expect(service.findPublishedBySlug(slug)).rejects.toEqual(
          new NotFoundException('Not found.'),
        );
      }
    });
  });

  describe('Spanish (Spec 004 phase 3)', () => {
    const spanish = {
      titleEs: 'Servir archivos desde Postgres',
      summaryEs: 'Por qué los archivos viven en la base de datos.',
      bodyEs: `## Por qué\n\n${words(580)}\n\n## Cómo\n\nTexto.`,
      references: [
        {
          title: 'Docs',
          titleEs: 'Documentación',
          url: 'https://www.postgresql.org/docs/',
        },
      ],
    };

    it('stores the Spanish fields and the Spanish reference titles', async () => {
      const created = await service.create({
        ...complete,
        ...spanish,
        slugEs: 'archivos',
      });

      expect(created).toMatchObject({
        titleEs: spanish.titleEs,
        slugEs: 'archivos',
        references: spanish.references,
      });
    });

    it('lists translated posts in Spanish with the Spanish reading time', async () => {
      await seedPublished(1, spanish);
      await seedPublished(0);

      const page = await service.listPublished({ page: 1, lang: 'es' });

      expect(page.items[0]).toMatchObject({
        title: spanish.titleEs,
        summary: spanish.summaryEs,
        readingMinutes: 3,
        lang: 'es',
      });
      expect(page.items[0]).not.toHaveProperty('summaryEs');
    });

    it('keeps the same posts on Spanish tag listings', async () => {
      await seedPublished(2, spanish);

      const en = await service.listPublished({ page: 1, tag: 'postgres' });
      const es = await service.listPublished({
        page: 1,
        tag: 'postgres',
        lang: 'es',
      });

      expect(es.items.map((post) => post.id)).toEqual(
        en.items.map((post) => post.id),
      );
      expect(es.tag).toBe(en.tag);
    });

    it('feeds posts in Spanish when translated and in English otherwise', async () => {
      await publishedAt(
        { ...complete, ...spanish, slug: 'one', slugEs: 'uno' },
        '2026-01-01T00:00:00Z',
      );
      await publishedAt(
        { ...complete, slug: 'two', titleEs: 'Solo título' },
        '2026-01-02T00:00:00Z',
      );

      const feed = await service.feed('es');

      expect(feed).toMatchObject([
        { slug: 'two', slugEs: null, title: complete.title, lang: 'en' },
        { slug: 'one', slugEs: 'uno', title: spanish.titleEs, lang: 'es' },
      ]);
    });

    it('builds the detail, toc and reading time from the shown language', async () => {
      await seedPublished(1, { ...spanish, slugEs: 'archivos' });

      const detail = await service.findPublishedBySlug('archivos', 'es');

      expect(detail).toMatchObject({
        title: spanish.titleEs,
        slug: 'post-1',
        slugEs: 'archivos',
        readingMinutes: 3,
        references: [
          { title: 'Documentación', url: 'https://www.postgresql.org/docs/' },
        ],
        lang: 'es',
      });
      expect(detail.toc.map((entry) => entry.text)).toEqual([
        'Por qué',
        'Cómo',
      ]);
      expect(detail.bodyHtml).toContain('id="por-que"');
    });

    it('shows the whole post in English when the Spanish body is missing', async () => {
      await seedPublished(1, { ...spanish, bodyEs: null });

      await expect(
        service.findPublishedBySlug('post-1', 'es'),
      ).resolves.toMatchObject({ title: complete.title, lang: 'en' });
    });

    it('marks every post of the owner list as translated or not', async () => {
      await service.create({ ...complete, ...spanish });
      await service.create({ ...complete, slug: 'other' });

      expect(
        (await service.listAll()).map(({ slug, translated }) => ({
          slug,
          translated,
        })),
      ).toEqual([
        { slug: 'other', translated: false },
        { slug: 'uploads', translated: true },
      ]);
    });

    it('answers 409 on slugEs for another post Spanish URL slug', async () => {
      await service.create(complete);

      await expect(
        service.create({ ...complete, slug: 'two', slugEs: 'uploads' }),
      ).rejects.toBeInstanceOf(ConflictException);
    });

    it('finds by English slug when a Spanish slug exists, for the redirect', async () => {
      await seedPublished(1, { slugEs: 'entrada' });

      await expect(
        service.findPublishedBySlug('post-1', 'es'),
      ).resolves.toMatchObject({ slug: 'post-1', slugEs: 'entrada' });
    });
  });
});
