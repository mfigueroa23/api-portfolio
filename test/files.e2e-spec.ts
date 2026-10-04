import { INestApplication } from '@nestjs/common';
import request from 'supertest';
import { App } from 'supertest/types.js';
import { PrismaFake } from './fakes/prisma.fake.js';
import { samples } from './fixtures/file-samples.js';
import { createTestApp } from './utils/create-test-app.js';
import { ownerToken } from './utils/owner-token.js';

const MIB = 1024 * 1024;
const PUBLIC_URL = 'https://api.example.test';

describe('/files (e2e)', () => {
  let app: INestApplication<App>;
  let prisma: PrismaFake;
  let token: string;

  beforeEach(async () => {
    vi.stubEnv('API_PUBLIC_URL', PUBLIC_URL);
    ({ app, prisma } = await createTestApp());
    token = await ownerToken(prisma);
  });

  afterEach(async () => {
    await app.close();
    vi.unstubAllEnvs();
  });

  const server = () => request(app.getHttpServer());
  const auth = () => `Bearer ${token}`;
  const upload = (name: string, bytes: Buffer, authorized = true) => {
    const req = server()
      .post(`/files?name=${encodeURIComponent(name)}`)
      .set('content-type', 'application/octet-stream');
    return (authorized ? req.set('Authorization', auth()) : req).send(bytes);
  };

  describe('POST /files', () => {
    it.each([
      ['photo.png', 'png', 'image/png'],
      ['photo.jpg', 'jpeg', 'image/jpeg'],
      ['anim.gif', 'gif', 'image/gif'],
      ['photo.webp', 'webp', 'image/webp'],
      ['logo.svg', 'svgWithProlog', 'image/svg+xml'],
      ['cv.pdf', 'pdf', 'application/pdf'],
    ] as const)(
      'stores %s and answers 201 with its URL',
      async (name, sample, mime) => {
        const response = await upload(name, samples[sample]);

        expect(response.status).toBe(201);
        expect(response.body).toEqual({
          id: expect.any(String),
          name,
          mime,
          size: samples[sample].length,
          createdAt: expect.any(String),
          url: `${PUBLIC_URL}/files/${response.body.id}`,
        });
        expect(prisma.file.rows).toHaveLength(1);
      },
    );

    it('keeps names with spaces, accents and symbols', async () => {
      const name = 'Diseño final (v2) #1.png';

      const response = await upload(name, samples.png);

      expect(response.body.name).toBe(name);
    });

    it('answers 400 to a text file renamed .png', async () => {
      const response = await upload('fake.png', samples.text);

      expect(response.status).toBe(400);
      expect(response.body).toEqual({ error: 'Unsupported file type.' });
      expect(prisma.file.rows).toEqual([]);
    });

    it('answers 400 to an image of 5 MiB + 1 byte', async () => {
      const bytes = Buffer.alloc(5 * MIB + 1);
      samples.png.copy(bytes);

      const response = await upload('big.png', bytes);

      expect(response.status).toBe(400);
      expect(response.body).toEqual({ error: 'File too large.' });
    });

    it('answers 400 to a body over 10 MiB after reading it', async () => {
      const bytes = Buffer.alloc(10 * MIB + 1);
      samples.pdf.copy(bytes);

      const response = await upload('big.pdf', bytes);

      expect(response.status).toBe(400);
      expect(response.body).toEqual({ error: 'File too large.' });
    });

    it('answers 400 without a name', async () => {
      const response = await server()
        .post('/files')
        .set('Authorization', auth())
        .set('content-type', 'application/octet-stream')
        .send(samples.png);

      expect(response.status).toBe(400);
      expect(response.body.error).toBe('Validation failed.');
      expect(Object.keys(response.body.fields)).toEqual(['name']);
    });

    it('answers 401 without a token and stores nothing', async () => {
      const response = await upload('a.png', samples.png, false);

      expect(response.status).toBe(401);
      expect(response.body).toEqual({ error: 'Unauthorized.' });
      expect(prisma.file.rows).toEqual([]);
    });
  });

  describe('GET /files/:id (public)', () => {
    it('serves the bytes with headers that keep an SVG script inert', async () => {
      const stored = await upload('evil.svg', samples.svgWithScript);

      const response = await server()
        .get(`/files/${stored.body.id}`)
        .buffer(true)
        .parse((res, done) => {
          const chunks: Buffer[] = [];
          res.on('data', (chunk: Buffer) => chunks.push(chunk));
          res.on('end', () => done(null, Buffer.concat(chunks)));
        });

      expect(response.status).toBe(200);
      expect(response.body).toEqual(samples.svgWithScript);
      expect(response.headers).toMatchObject({
        'content-type': 'image/svg+xml',
        'x-content-type-options': 'nosniff',
        'content-security-policy': expect.stringMatching(/sandbox$/),
        'content-disposition': "inline; filename*=UTF-8''evil.svg",
        'cache-control': 'public, max-age=31536000, immutable',
        'cross-origin-resource-policy': 'cross-origin',
      });
    });

    it('answers 404 for an unknown or malformed id', async () => {
      for (const id of ['2b1e0a4c-5d3f-4e2a-9b8c-7d6e5f4a3b2c', 'nope']) {
        const response = await server().get(`/files/${id}`);

        expect(response.status).toBe(404);
        expect(response.body).toEqual({ error: 'Not found.' });
      }
    });
  });

  describe('GET /files', () => {
    it('requires a token', async () => {
      const response = await server().get('/files');

      expect(response.status).toBe(401);
    });

    it('pages by 50 newest first and filters by type', async () => {
      for (let index = 0; index < 51; index++) {
        await upload(`img-${index}.png`, samples.png);
      }
      await upload('doc.pdf', samples.pdf);
      prisma.file.rows.forEach((row, index) => {
        row.createdAt = new Date(Date.UTC(2026, 0, 1, 0, 0, index));
      });

      const first = await server().get('/files').set('Authorization', auth());
      const second = await server()
        .get('/files?page=2')
        .set('Authorization', auth());
      const pdfs = await server()
        .get('/files?type=pdf')
        .set('Authorization', auth());

      expect(first.status).toBe(200);
      expect(first.body).toMatchObject({ page: 1, totalPages: 2, total: 52 });
      expect(first.body.items).toHaveLength(50);
      expect(first.body.items[0]).toMatchObject({ name: 'doc.pdf' });
      expect(first.body.items[0]).not.toHaveProperty('data');
      expect(
        second.body.items.map((file: { name: string }) => file.name),
      ).toEqual(['img-1.png', 'img-0.png']);
      expect(pdfs.body).toMatchObject({ total: 1, totalPages: 1 });
    });

    it('answers 400 to an invalid page or type', async () => {
      for (const query of ['page=0', 'page=abc', 'type=video']) {
        const response = await server()
          .get(`/files?${query}`)
          .set('Authorization', auth());

        expect(response.status).toBe(400);
      }
    });
  });

  describe('references and deletion', () => {
    it('lists the items that use a file, drafts included', async () => {
      const stored = await upload('cover.png', samples.png);
      const url: string = stored.body.url;
      await prisma.post.create({
        data: { slug: 'draft', title: 'Draft post', coverUrl: url },
      });
      await prisma.project.create({
        data: {
          slug: 'live',
          title: 'Live project',
          body: `![cover](${url})`,
          status: 'published',
        },
      });

      const response = await server()
        .get(`/files/${stored.body.id}/references`)
        .set('Authorization', auth());

      expect(response.status).toBe(200);
      expect(response.body).toEqual([
        {
          collection: 'projects',
          id: 1,
          title: 'Live project',
          status: 'published',
        },
        { collection: 'posts', id: 1, title: 'Draft post', status: 'draft' },
      ]);
    });

    it('requires a token for references and deletion', async () => {
      const stored = await upload('a.png', samples.png);

      const references = await server().get(
        `/files/${stored.body.id}/references`,
      );
      const remove = await server().delete(`/files/${stored.body.id}`);

      expect(references.status).toBe(401);
      expect(remove.status).toBe(401);
      expect(prisma.file.rows).toHaveLength(1);
    });

    it('answers 404 to the references of an unknown file', async () => {
      const response = await server()
        .get('/files/2b1e0a4c-5d3f-4e2a-9b8c-7d6e5f4a3b2c/references')
        .set('Authorization', auth());

      expect(response.status).toBe(404);
    });

    it('deletes a file with 204, then answers 404', async () => {
      const stored = await upload('a.png', samples.png);

      const removed = await server()
        .delete(`/files/${stored.body.id}`)
        .set('Authorization', auth());
      const read = await server().get(`/files/${stored.body.id}`);
      const again = await server()
        .delete(`/files/${stored.body.id}`)
        .set('Authorization', auth());

      expect(removed.status).toBe(204);
      expect(read.status).toBe(404);
      expect(again.status).toBe(404);
    });
  });
});
