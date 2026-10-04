import { INestApplication } from '@nestjs/common';
import request from 'supertest';
import { App } from 'supertest/types.js';
import { PrismaFake } from './fakes/prisma.fake.js';
import { createTestApp } from './utils/create-test-app.js';
import { ownerToken } from './utils/owner-token.js';

const draft = { slug: 'portfolio', title: 'Portfolio' };
const complete = {
  ...draft,
  description: 'Personal site.',
  image: 'https://api.figueroa-sanchez.com/files/1',
  tags: ['Angular'],
  body: '## Architecture\n\n```mermaid\ngraph TD\n  A-->B\n```',
};

describe('/content/projects (e2e)', () => {
  let app: INestApplication<App>;
  let prisma: PrismaFake;
  let token: string;

  beforeEach(async () => {
    ({ app, prisma } = await createTestApp());
    token = await ownerToken(prisma);
  });

  afterEach(async () => {
    await app.close();
    vi.useRealTimers();
  });

  const server = () => request(app.getHttpServer());
  const admin = (req: request.Test) =>
    req.set('Authorization', `Bearer ${token}`);
  const create = (body: object) =>
    admin(server().post('/content/projects')).send(body);
  const publish = (id: number) =>
    admin(server().post(`/content/projects/${id}/publish`));
  const unpublish = (id: number) =>
    admin(server().post(`/content/projects/${id}/unpublish`));
  const publicSlugs = async (query = '') =>
    (await server().get(`/content/projects${query}`)).body.map(
      (row: { slug: string }) => row.slug,
    );

  // Publishes at a fixed instant so the list order is deterministic.
  async function publishAt(id: number, iso: string) {
    vi.useFakeTimers({ now: new Date(iso), toFake: ['Date'] });
    const response = await publish(id);
    vi.useRealTimers();
    return response;
  }

  it('stores a new project as a draft hidden from public reads', async () => {
    const created = await create(draft);

    expect(created.status).toBe(201);
    expect(created.body).toMatchObject({
      ...draft,
      status: 'draft',
      publishedAt: null,
    });
    expect(await publicSlugs()).toEqual([]);
    expect((await server().get('/content/projects/portfolio')).status).toBe(
      404,
    );
  });

  it('answers 400 with field errors when publishing an incomplete draft', async () => {
    const created = await create(draft);

    const response = await publish(created.body.id);

    expect(response.status).toBe(400);
    expect(response.body).toEqual({
      error: 'Validation failed.',
      fields: {
        description: ['description is required to publish.'],
        image: ['image is required to publish.'],
      },
    });
  });

  it('publishes a project: listed without body and served by slug with bodyHtml', async () => {
    const created = await create(complete);

    const published = await publish(created.body.id);
    const list = await server().get('/content/projects');
    const detail = await server().get('/content/projects/portfolio');

    expect(published.status).toBe(200);
    expect(published.body).toMatchObject({
      status: 'published',
      publishedAt: expect.any(String),
    });
    expect(list.body).toHaveLength(1);
    expect(list.body[0]).not.toHaveProperty('body');
    expect(detail.status).toBe(200);
    expect(detail.body).toMatchObject({
      ...complete,
      bodyHtml: expect.stringContaining(
        '<figure class="md-mermaid"><pre class="mermaid-source">',
      ),
    });
    expect(detail.body.bodyHtml).toContain(
      '<h2 id="architecture">Architecture</h2>',
    );
  });

  it('unpublishes: 404 by slug, first publication date kept', async () => {
    const created = await create(complete);
    const first = await publishAt(created.body.id, '2026-01-01T00:00:00Z');

    const back = await unpublish(created.body.id);
    const detail = await server().get('/content/projects/portfolio');
    const again = await publishAt(created.body.id, '2026-06-01T00:00:00Z');

    expect(back.status).toBe(200);
    expect(back.body).toMatchObject({
      status: 'draft',
      publishedAt: '2026-01-01T00:00:00.000Z',
    });
    expect(detail.status).toBe(404);
    expect(first.body.publishedAt).toBe('2026-01-01T00:00:00.000Z');
    expect(again.body.publishedAt).toBe('2026-01-01T00:00:00.000Z');
  });

  it('requires the token for admin reads and the publication actions', async () => {
    const created = await create(complete);

    const responses = [
      await server().get('/content/projects/all'),
      await server().post(`/content/projects/${created.body.id}/publish`),
      await server().post(`/content/projects/${created.body.id}/unpublish`),
    ];

    for (const response of responses) expect(response.status).toBe(401);
  });

  it('lists every project for the owner, drafts first', async () => {
    const live = await create({ ...complete, slug: 'live' });
    await publish(live.body.id);
    await create({ ...draft, slug: 'wip' });

    const response = await admin(server().get('/content/projects/all'));

    expect(response.status).toBe(200);
    expect(
      response.body.map((row: { slug: string; status: string }) => [
        row.slug,
        row.status,
      ]),
    ).toEqual([
      ['wip', 'draft'],
      ['live', 'published'],
    ]);
    expect(response.body[1]).toHaveProperty('body', complete.body);
  });

  it('answers 409 with a slug field error for a duplicate slug', async () => {
    await create(draft);
    const other = await create({ ...draft, slug: 'other' });

    const duplicate = await create(draft);
    const renamed = await admin(
      server().put(`/content/projects/${other.body.id}`),
    ).send(draft);

    for (const response of [duplicate, renamed]) {
      expect(response.status).toBe(409);
      expect(response.body).toEqual({
        error: 'This slug is already in use.',
        fields: { slug: ['This slug is already in use.'] },
      });
    }
  });

  it('answers 400 for an invalid slug', async () => {
    for (const slug of ['Bad Slug', '-a', 'a--b', 'a'.repeat(101), 'all']) {
      const response = await create({ ...draft, slug });

      expect(response.status).toBe(400);
      expect(Object.keys(response.body.fields)).toEqual(['slug']);
    }
    expect(prisma.project.rows).toEqual([]);
  });

  it('limits the public list with ?limit= and validates it', async () => {
    for (const [index, slug] of ['a', 'b', 'c', 'd', 'e', 'f'].entries()) {
      const created = await create({ ...complete, slug });
      await publishAt(created.body.id, `2026-01-0${index + 1}T00:00:00Z`);
    }

    expect(await publicSlugs('?limit=4')).toEqual(['f', 'e', 'd', 'c']);
    expect(await publicSlugs()).toHaveLength(6);
    for (const limit of ['0', '51', 'x']) {
      expect(
        (await server().get(`/content/projects?limit=${limit}`)).status,
      ).toBe(400);
    }
  });

  it('orders by first publication date, so a republished project keeps its place', async () => {
    const ids: Record<string, number> = {};
    for (const [slug, iso] of [
      ['old', '2025-01-01T00:00:00Z'],
      ['mid', '2025-06-01T00:00:00Z'],
      ['new', '2026-01-01T00:00:00Z'],
    ]) {
      ids[slug] = (await create({ ...complete, slug })).body.id;
      await publishAt(ids[slug], iso);
    }

    await unpublish(ids.old);
    await publishAt(ids.old, '2026-09-01T00:00:00Z');

    expect(await publicSlugs()).toEqual(['new', 'mid', 'old']);
  });

  it('accepts a body of 400 KB', async () => {
    const body = 'é'.repeat(100_000);
    expect(Buffer.byteLength(JSON.stringify({ body }))).toBeGreaterThan(
      200_000,
    );

    const response = await create({ ...complete, body });

    expect(response.status).toBe(201);
    expect(response.body.body).toHaveLength(100_000);
  });

  it('answers 400 to a body over 100,000 characters', async () => {
    const response = await create({ ...complete, body: 'a'.repeat(100_001) });

    expect(response.status).toBe(400);
    expect(Object.keys(response.body.fields)).toEqual(['body']);
  });

  it('keeps description and image required while published', async () => {
    const created = await create(complete);
    await publish(created.body.id);

    const response = await admin(
      server().put(`/content/projects/${created.body.id}`),
    ).send({ ...draft, description: '', image: '' });

    expect(response.status).toBe(400);
    expect(Object.keys(response.body.fields)).toEqual(['description', 'image']);
  });

  it('answers 404 to publishing a missing project', async () => {
    expect((await publish(999)).status).toBe(404);
    expect((await unpublish(999)).status).toBe(404);
  });
});
