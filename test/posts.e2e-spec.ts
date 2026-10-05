import { INestApplication } from '@nestjs/common';
import request from 'supertest';
import { App } from 'supertest/types.js';
import { createTestApp } from './utils/create-test-app.js';
import { ownerToken } from './utils/owner-token.js';

const complete = {
  title: 'Hello',
  slug: 'hello',
  summary: 'A first post.',
  tags: ['Angular', 'Web Dev'],
  body: `## Intro\n\n${Array.from({ length: 450 }, () => 'word').join(' ')}\n\n## Intro\n\n\`\`\`ts\nconst x = 1;\n\`\`\``,
  references: [{ title: 'Docs', url: 'https://angular.dev' }],
};

describe('/content/posts (e2e)', () => {
  let app: INestApplication<App>;
  let token: string;

  beforeEach(async () => {
    const created = await createTestApp();
    app = created.app;
    token = await ownerToken(created.prisma);
  });

  afterEach(async () => {
    await app.close();
    vi.useRealTimers();
  });

  const server = () => request(app.getHttpServer());
  const admin = (req: request.Test) =>
    req.set('Authorization', `Bearer ${token}`);
  const create = (body: object) =>
    admin(server().post('/content/posts')).send(body);

  async function publishAt(body: object, iso: string) {
    const created = await create(body);
    vi.useFakeTimers({ now: new Date(iso), toFake: ['Date'] });
    const response = await admin(
      server().post(`/content/posts/${created.body.id}/publish`),
    );
    vi.useRealTimers();
    expect(response.status).toBe(200);
    return response.body as { id: number; slug: string };
  }

  // n published posts, post-1 oldest.
  async function seed(n: number, extra: object = {}) {
    for (let index = 1; index <= n; index++) {
      await publishAt(
        { ...complete, ...extra, slug: `post-${index}` },
        new Date(Date.UTC(2026, 0, index)).toISOString(),
      );
    }
  }
  const slugsOf = (body: { items: { slug: string }[] }) =>
    body.items.map((post) => post.slug);

  it('pages 10 per page: 11 posts leave 1 on page 2 and page 3 is 404', async () => {
    await seed(11);

    const first = await server().get('/content/posts');
    const second = await server().get('/content/posts?page=2');
    const third = await server().get('/content/posts?page=3');

    expect(first.status).toBe(200);
    expect(first.body).toMatchObject({
      page: 1,
      totalPages: 2,
      total: 11,
      tag: null,
    });
    expect(first.body.items).toHaveLength(10);
    expect(first.body.items[0]).toMatchObject({
      slug: 'post-11',
      readingMinutes: 3,
      publishedAt: '2026-01-11T00:00:00.000Z',
    });
    expect(first.body.items[0]).not.toHaveProperty('body');
    expect(slugsOf(second.body)).toEqual(['post-1']);
    expect(third.status).toBe(404);
  });

  it('answers 400 to a page that is not a positive integer', async () => {
    for (const page of ['0', '-1', 'abc', '1.5']) {
      expect((await server().get(`/content/posts?page=${page}`)).status).toBe(
        400,
      );
    }
  });

  it('filters by tag ignoring case, with the display name', async () => {
    await seed(2);
    await publishAt(
      { ...complete, slug: 'other', tags: ['Rust'] },
      '2026-03-01T00:00:00Z',
    );

    for (const tag of ['web-dev', 'WEB-DEV', 'Web-Dev']) {
      const response = await server().get(`/content/posts?tag=${tag}`);

      expect(response.status).toBe(200);
      expect(response.body).toMatchObject({ total: 2, tag: 'Web Dev' });
      expect(slugsOf(response.body)).toEqual(['post-2', 'post-1']);
    }
  });

  it('answers 404 to an unknown tag or one used only by drafts', async () => {
    await seed(1);
    await create({ ...complete, slug: 'draft', tags: ['Secret'] });

    expect((await server().get('/content/posts?tag=nope')).status).toBe(404);
    expect((await server().get('/content/posts?tag=secret')).status).toBe(404);
  });

  it('answers 400 with a slug field error for reserved slugs', async () => {
    for (const slug of ['tag', 'page', 'all', 'feed']) {
      const response = await create({ ...complete, slug });

      expect(response.status).toBe(400);
      expect(Object.keys(response.body.fields)).toEqual(['slug']);
    }
  });

  it('answers 409 for a duplicate slug', async () => {
    await create(complete);

    const response = await create(complete);

    expect(response.status).toBe(409);
    expect(response.body.fields).toEqual({
      slug: ['This slug is already in use.'],
    });
  });

  it('treats tags that differ only in case or spaces as one', async () => {
    const response = await create({
      ...complete,
      tags: ['Angular', ' angular ', 'ANGULAR'],
    });

    expect(response.body).toMatchObject({
      tags: ['Angular'],
      tagKeys: ['angular'],
    });
  });

  it('feeds the 20 most recent published posts in date order', async () => {
    await seed(21);
    await create({ ...complete, slug: 'draft' });

    const response = await server().get('/content/posts/feed');

    expect(response.status).toBe(200);
    expect(response.body).toHaveLength(20);
    expect(response.body.map((post: { slug: string }) => post.slug)).toEqual(
      Array.from({ length: 20 }, (_, index) => `post-${21 - index}`),
    );
  });

  it('serves a published post with toc, reading time and references', async () => {
    await publishAt(complete, '2026-01-01T00:00:00Z');

    const response = await server().get('/content/posts/hello');

    expect(response.status).toBe(200);
    expect(response.body).toMatchObject({
      slug: 'hello',
      toc: [
        { level: 2, text: 'Intro', id: 'intro' },
        { level: 2, text: 'Intro', id: 'intro-2' },
      ],
      readingMinutes: 3,
      references: complete.references,
      bodyHtml: expect.stringContaining('<h2 id="intro-2">Intro</h2>'),
    });
  });

  it('never returns drafts from the list, feed or detail', async () => {
    const created = await create(complete);
    const published = await publishAt(
      { ...complete, slug: 'live' },
      '2026-01-01T00:00:00Z',
    );
    await admin(server().post(`/content/posts/${published.id}/unpublish`));

    const list = await server().get('/content/posts');
    const feed = await server().get('/content/posts/feed');
    const detail = await server().get('/content/posts/hello');
    const unpublished = await server().get('/content/posts/live');
    const all = await admin(server().get('/content/posts/all'));

    expect(list.body).toMatchObject({ items: [], total: 0, totalPages: 0 });
    expect(feed.body).toEqual([]);
    expect(detail.status).toBe(404);
    expect(unpublished.status).toBe(404);
    expect(all.body).toHaveLength(2);
    expect(all.body.map((post: { id: number }) => post.id)).toEqual(
      expect.arrayContaining([created.body.id, published.id]),
    );
  });

  it('requires the token for the admin list and every write', async () => {
    const created = await create(complete);
    const id: number = created.body.id;

    const responses = [
      await server().get('/content/posts/all'),
      await server().post('/content/posts').send(complete),
      await server().put(`/content/posts/${id}`).send(complete),
      await server().post(`/content/posts/${id}/publish`),
      await server().post(`/content/posts/${id}/unpublish`),
      await server().delete(`/content/posts/${id}`),
    ];

    for (const response of responses) expect(response.status).toBe(401);
  });

  it('refuses to publish without summary and body', async () => {
    const created = await create({ title: 'T', slug: 't' });

    const response = await admin(
      server().post(`/content/posts/${created.body.id}/publish`),
    );

    expect(response.status).toBe(400);
    expect(Object.keys(response.body.fields)).toEqual(['summary', 'body']);
  });

  it('updates and deletes a post', async () => {
    const created = await create(complete);
    const id: number = created.body.id;

    const updated = await admin(server().put(`/content/posts/${id}`)).send({
      ...complete,
      title: 'Renamed',
    });
    const removed = await admin(server().delete(`/content/posts/${id}`));
    const again = await admin(server().delete(`/content/posts/${id}`));

    expect(updated.body).toMatchObject({ title: 'Renamed' });
    expect(removed.status).toBe(204);
    expect(again.status).toBe(404);
  });

  it('accepts a body of 100,000 multi-byte characters', async () => {
    const response = await create({ ...complete, body: 'ñ'.repeat(100_000) });

    expect(response.status).toBe(201);
  });
});
