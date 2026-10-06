import {
  BadRequestException,
  ConflictException,
  NotFoundException,
} from '@nestjs/common';
import { PrismaFake } from '../../../../test/fakes/prisma.fake.js';
import { PrismaService } from '../../database/prisma.service.js';
import { MarkdownService } from '../../markdown/markdown.service.js';
import { ProjectDto } from './dto/projects.dto.js';
import { ProjectsService } from './projects.service.js';

const item = {
  slug: 'portfolio',
  title: 'Portfolio',
  description: 'Personal site.',
  image: 'https://api.figueroa-sanchez.com/files/1',
  tags: ['Angular'],
  link: 'https://example.com',
  github: 'https://github.com/example/portfolio',
  body: '## Architecture\n\nDetails.',
} satisfies ProjectDto;

describe('ProjectsService', () => {
  let prisma: PrismaFake;
  let service: ProjectsService;

  beforeEach(() => {
    prisma = new PrismaFake();
    service = new ProjectsService(
      prisma as unknown as PrismaService,
      new MarkdownService(),
    );
  });

  // Creates a project and publishes it at the given instant.
  async function published(slug: string, at: string) {
    const created = await service.create({ ...item, slug });
    vi.useFakeTimers({ now: new Date(at) });
    try {
      return await service.publish(created.id);
    } finally {
      vi.useRealTimers();
    }
  }

  describe('writes', () => {
    it('stores a new project as a draft', async () => {
      const created = await service.create(item);

      expect(created).toMatchObject({
        id: 1,
        ...item,
        status: 'draft',
        publishedAt: null,
      });
    });

    it('saves a draft with only its title and slug', async () => {
      const created = await service.create({ slug: 'bare', title: 'Bare' });

      expect(created).toMatchObject({
        slug: 'bare',
        title: 'Bare',
        description: null,
        image: null,
        tags: [],
        link: null,
        github: null,
        body: null,
      });
    });

    it('answers 409 when the slug is used by another project', async () => {
      const first = await service.create(item);
      const second = await service.create({ ...item, slug: 'other' });

      await expect(service.create(item)).rejects.toBeInstanceOf(
        ConflictException,
      );
      await expect(
        service.update(second.id, { ...item, slug: 'portfolio' }),
      ).rejects.toBeInstanceOf(ConflictException);
      await expect(
        service.update(first.id, { ...item, title: 'Same slug' }),
      ).resolves.toMatchObject({ title: 'Same slug' });
    });

    it('lets a draft lose its description and image', async () => {
      const created = await service.create(item);

      await expect(
        service.update(created.id, { slug: 'portfolio', title: 'Portfolio' }),
      ).resolves.toMatchObject({ description: null, image: null });
    });

    it('requires description and image while the project is published', async () => {
      const project = await published('live', '2026-01-01T00:00:00Z');

      const error = await service
        .update(project.id, { slug: 'live', title: 'Live', image: '' })
        .catch((caught: unknown) => caught);

      expect(error).toBeInstanceOf(BadRequestException);
      expect(
        Object.keys(
          ((error as BadRequestException).getResponse() as { fields: object })
            .fields,
        ),
      ).toEqual(['description', 'image']);
    });

    it('answers 404 when updating or removing a missing project', async () => {
      await expect(service.update(99, item)).rejects.toBeInstanceOf(
        NotFoundException,
      );
      await expect(service.remove(99)).rejects.toMatchObject({ code: 'P2025' });
    });

    it('removes a project', async () => {
      const created = await service.create(item);

      await service.remove(created.id);

      expect(await service.listAll()).toEqual([]);
    });
  });

  describe('publication', () => {
    it('publishes with the current date and keeps it when republished', async () => {
      const project = await published('live', '2026-01-01T00:00:00Z');

      const draft = await service.unpublish(project.id);
      vi.useFakeTimers({ now: new Date('2026-06-01T00:00:00Z') });
      const again = await service.publish(project.id);
      vi.useRealTimers();

      expect(project).toMatchObject({
        status: 'published',
        publishedAt: new Date('2026-01-01T00:00:00Z'),
      });
      expect(draft).toMatchObject({
        status: 'draft',
        publishedAt: new Date('2026-01-01T00:00:00Z'),
      });
      expect(again.publishedAt).toEqual(new Date('2026-01-01T00:00:00Z'));
    });

    it('refuses to publish without description and image', async () => {
      const created = await service.create({ slug: 'bare', title: 'Bare' });

      const error = await service
        .publish(created.id)
        .catch((caught: unknown) => caught);

      expect(error).toBeInstanceOf(BadRequestException);
      expect((error as BadRequestException).getResponse()).toEqual({
        error: 'Validation failed.',
        fields: {
          description: ['description is required to publish.'],
          image: ['image is required to publish.'],
        },
      });
      expect(
        (await prisma.project.findUnique({ where: { id: 1 } }))?.status,
      ).toBe('draft');
    });

    it('answers 404 when publishing a missing project', async () => {
      await expect(service.publish(99)).rejects.toBeInstanceOf(
        NotFoundException,
      );
      await expect(service.unpublish(99)).rejects.toMatchObject({
        code: 'P2025',
      });
    });
  });

  describe('reads', () => {
    it('lists published projects newest first without drafts or bodies', async () => {
      await published('old', '2025-01-01T00:00:00Z');
      await service.create({ ...item, slug: 'draft' });
      await published('new', '2026-01-01T00:00:00Z');
      await published('mid', '2025-06-01T00:00:00Z');

      const list = await service.listPublished();

      expect(list.map((row) => row.slug)).toEqual(['new', 'mid', 'old']);
      expect(list[0]).not.toHaveProperty('body');
      expect(list[0]).toMatchObject({ status: 'published' });
    });

    it('breaks publication date ties by id, newest first', async () => {
      await published('a', '2026-01-01T00:00:00Z');
      await published('b', '2026-01-01T00:00:00Z');

      expect((await service.listPublished()).map((row) => row.slug)).toEqual([
        'b',
        'a',
      ]);
    });

    it('limits the public list', async () => {
      for (const [index, slug] of ['a', 'b', 'c', 'd', 'e'].entries()) {
        await published(slug, `2026-01-0${index + 1}T00:00:00Z`);
      }

      expect((await service.listPublished(4)).map((row) => row.slug)).toEqual([
        'e',
        'd',
        'c',
        'b',
      ]);
    });

    it('lists every project for the owner, drafts first', async () => {
      await published('old', '2025-01-01T00:00:00Z');
      await service.create({ ...item, slug: 'draft' });
      await published('new', '2026-01-01T00:00:00Z');

      const all = await service.listAll();

      expect(all.map((row) => row.slug)).toEqual(['draft', 'new', 'old']);
      expect(all[0]).toHaveProperty('body', item.body);
    });

    it('returns a published project by slug with its rendered body', async () => {
      await published('live', '2026-01-01T00:00:00Z');

      await expect(service.findPublishedBySlug('live')).resolves.toMatchObject({
        slug: 'live',
        body: item.body,
        bodyHtml: '<h2 id="architecture">Architecture</h2>\n<p>Details.</p>\n',
      });
    });

    it('renders an empty body as empty HTML', async () => {
      const created = await service.create({ ...item, slug: 'live' });
      await prisma.project.update({
        where: { id: created.id },
        data: { body: null },
      });
      await service.publish(created.id);

      await expect(service.findPublishedBySlug('live')).resolves.toMatchObject({
        bodyHtml: '',
      });
    });

    it('answers 404 for a draft or unknown slug', async () => {
      await service.create({ ...item, slug: 'draft' });

      for (const slug of ['draft', 'missing']) {
        await expect(service.findPublishedBySlug(slug)).rejects.toEqual(
          new NotFoundException('Not found.'),
        );
      }
    });
  });

  describe('Spanish (Spec 004 phase 3)', () => {
    const spanish = {
      titleEs: 'Portafolio',
      descriptionEs: 'Sitio personal.',
      bodyEs: '## Arquitectura\n\nDetalles.',
    };

    async function publishedWith(dto: ProjectDto) {
      const created = await service.create(dto);
      return service.publish(created.id);
    }

    it('stores the Spanish fields and slug', async () => {
      const created = await service.create({
        ...item,
        ...spanish,
        slugEs: 'portafolio',
      });

      expect(created).toMatchObject({ ...spanish, slugEs: 'portafolio' });
    });

    it('lists translated projects in Spanish with slug and slugEs', async () => {
      await publishedWith({ ...item, ...spanish, slugEs: 'portafolio' });

      const [row] = await service.listPublished(undefined, 'es');

      expect(row).toMatchObject({
        title: 'Portafolio',
        description: 'Sitio personal.',
        slug: 'portfolio',
        slugEs: 'portafolio',
        lang: 'es',
      });
      expect(row).not.toHaveProperty('body');
      expect(row).not.toHaveProperty('bodyEs');
      expect(row).not.toHaveProperty('titleEs');
    });

    it('lists a project without Spanish body in English, also on the list', async () => {
      await publishedWith({ ...item, ...spanish, bodyEs: null });

      expect((await service.listPublished(undefined, 'es'))[0]).toMatchObject({
        title: 'Portfolio',
        lang: 'en',
      });
    });

    it('renders the body of the language it shows', async () => {
      await publishedWith({ ...item, ...spanish });

      const detail = await service.findPublishedBySlug('portfolio', 'es');

      expect(detail).toMatchObject({ title: 'Portafolio', lang: 'es' });
      expect(detail.bodyHtml).toContain('Arquitectura');
      expect(
        (await service.findPublishedBySlug('portfolio')).bodyHtml,
      ).toContain('Architecture');
    });

    it('marks every project of the owner list as translated or not', async () => {
      await service.create({ ...item, ...spanish });
      await service.create({ ...item, slug: 'other' });

      expect(
        (await service.listAll()).map(({ slug, translated }) => ({
          slug,
          translated,
        })),
      ).toEqual([
        { slug: 'other', translated: false },
        { slug: 'portfolio', translated: true },
      ]);
    });

    describe('Spanish URL slug', () => {
      it('answers 409 on slugEs when it equals another project slug', async () => {
        await service.create(item);

        const error = await service
          .create({ ...item, slug: 'other', slugEs: 'portfolio' })
          .catch((e: unknown) => e);

        expect(error).toBeInstanceOf(ConflictException);
        expect((error as ConflictException).getResponse()).toEqual({
          error: 'This slug is already in use.',
          fields: { slugEs: ['This slug is already in use.'] },
        });
      });

      it('answers 409 when the slug equals another project Spanish slug', async () => {
        await service.create({ ...item, slugEs: 'proyecto' });

        await expect(
          service.create({ ...item, slug: 'proyecto' }),
        ).rejects.toBeInstanceOf(ConflictException);
      });

      it('allows the Spanish slug to equal its own slug, also on update', async () => {
        const created = await service.create({ ...item, slugEs: 'portfolio' });

        await expect(
          service.update(created.id, { ...item, slugEs: 'portfolio' }),
        ).resolves.toMatchObject({ slugEs: 'portfolio' });
      });

      it('finds a project by its Spanish slug', async () => {
        await publishedWith({ ...item, ...spanish, slugEs: 'portafolio' });

        await expect(
          service.findPublishedBySlug('portafolio', 'es'),
        ).resolves.toMatchObject({ slug: 'portfolio', slugEs: 'portafolio' });
        await expect(
          service.findPublishedBySlug('portafolio'),
        ).rejects.toBeInstanceOf(NotFoundException);
      });

      it('finds a project without Spanish slug by its English slug', async () => {
        await publishedWith(item);

        await expect(
          service.findPublishedBySlug('portfolio', 'es'),
        ).resolves.toMatchObject({ slug: 'portfolio', slugEs: null });
      });

      it('finds a project by its English slug when it has a Spanish one (for the redirect)', async () => {
        await publishedWith({ ...item, slugEs: 'portafolio' });

        await expect(
          service.findPublishedBySlug('portfolio', 'es'),
        ).resolves.toMatchObject({ slug: 'portfolio', slugEs: 'portafolio' });
      });

      it('never finds a draft by its Spanish slug', async () => {
        await service.create({ ...item, slugEs: 'portafolio' });

        await expect(
          service.findPublishedBySlug('portafolio', 'es'),
        ).rejects.toBeInstanceOf(NotFoundException);
      });
    });
  });
});
