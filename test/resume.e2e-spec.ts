import { INestApplication } from '@nestjs/common';
import request from 'supertest';
import { App } from 'supertest/types.js';
import { PrismaFake } from './fakes/prisma.fake.js';
import { samples } from './fixtures/file-samples.js';
import { createTestApp } from './utils/create-test-app.js';
import { ownerToken } from './utils/owner-token.js';

const PUBLIC_URL = 'https://api.example.test';
const UNKNOWN_ID = '2b1e0a4c-5d3f-4e2a-9b8c-7d6e5f4a3b2c';
const ENGLISH_PDF = samples.pdf;
const SPANISH_PDF = Buffer.concat([samples.pdf, Buffer.from('es\n')]);
const NEWER_PDF = Buffer.concat([samples.pdf, Buffer.from('v2\n')]);

interface Uploaded {
  id: string;
  name: string;
  mime: string;
  size: number;
  createdAt: string;
  url: string;
}

// Collects the raw body so the PDF bytes can be compared exactly.
function binary(
  res: NodeJS.ReadableStream,
  done: (error: Error | null, body: Buffer) => void,
): void {
  const chunks: Buffer[] = [];
  res.on('data', (chunk: Buffer) => chunks.push(chunk));
  res.on('end', () => done(null, Buffer.concat(chunks)));
}

describe('/resume (e2e)', () => {
  let app: INestApplication<App>;
  let prisma: PrismaFake;
  let token: string;
  let english: Uploaded;
  let spanish: Uploaded;

  beforeEach(async () => {
    vi.stubEnv('API_PUBLIC_URL', PUBLIC_URL);
    ({ app, prisma } = await createTestApp());
    token = await ownerToken(prisma);
    english = await upload('Marco CV.pdf', ENGLISH_PDF);
    spanish = await upload('Marco CV (es).pdf', SPANISH_PDF);
  });

  afterEach(async () => {
    await app.close();
    vi.useRealTimers();
    vi.unstubAllEnvs();
  });

  const server = () => request(app.getHttpServer());
  const auth = () => `Bearer ${token}`;

  async function upload(name: string, bytes: Buffer): Promise<Uploaded> {
    const response = await server()
      .post(`/files?name=${encodeURIComponent(name)}`)
      .set('Authorization', auth())
      .set('content-type', 'application/octet-stream')
      .send(bytes);
    expect(response.status).toBe(201);
    return response.body as Uploaded;
  }

  const assign = (lang: string, fileId: unknown) =>
    server()
      .put(`/resume/assignments/${lang}`)
      .set('Authorization', auth())
      .send({ fileId });
  const clear = (lang: string) =>
    server().delete(`/resume/assignments/${lang}`).set('Authorization', auth());
  const assignments = () =>
    server().get('/resume/assignments').set('Authorization', auth());
  const download = (query = '') =>
    server().get(`/resume${query}`).buffer(true).parse(binary);

  describe('GET /resume/assignments (E1)', () => {
    it('answers null for both languages, then the assigned file', async () => {
      const empty = await assignments();
      await assign('en', english.id);
      const assigned = await assignments();

      expect(empty.status).toBe(200);
      expect(empty.body).toEqual({ en: null, es: null });
      expect(assigned.status).toBe(200);
      expect(assigned.body).toEqual({
        en: { file: english, assignedAt: expect.any(String) },
        es: null,
      });
      expect(assigned.body.en.file.url).toBe(
        `${PUBLIC_URL}/files/${english.id}`,
      );
    });
  });

  describe('owner authentication (E2)', () => {
    it.each([
      ['without a token', undefined],
      ['with a bad token', 'Bearer not-a-jwt'],
    ])('answers 401 %s and changes nothing', async (_, header) => {
      await assign('en', english.id);
      const before = structuredClone(prisma.resume.rows);
      const withAuth = (req: request.Test) =>
        header ? req.set('Authorization', header) : req;

      const responses = await Promise.all([
        withAuth(server().get('/resume/assignments')),
        withAuth(
          server().put('/resume/assignments/en').send({ fileId: spanish.id }),
        ),
        withAuth(server().delete('/resume/assignments/en')),
      ]);

      for (const response of responses) {
        expect(response.status).toBe(401);
        expect(response.body).toEqual({ error: 'Unauthorized.' });
      }
      expect(prisma.resume.rows).toEqual(before);
    });
  });

  describe('PUT /resume/assignments/:lang (E3, E4, E5)', () => {
    it('assigns, replaces keeping the old file and reassigns idempotently (E3)', async () => {
      vi.useFakeTimers({
        now: new Date('2026-01-01T00:00:00Z'),
        toFake: ['Date'],
      });
      const first = await assign('en', english.id);
      vi.setSystemTime(new Date('2026-02-01T00:00:00Z'));
      const replaced = await assign('en', spanish.id);
      vi.setSystemTime(new Date('2026-03-01T00:00:00Z'));
      const again = await assign('en', spanish.id);
      const library = await server()
        .get('/files?type=pdf')
        .set('Authorization', auth());

      expect(first.status).toBe(200);
      expect(first.body).toEqual({
        en: { file: english, assignedAt: '2026-01-01T00:00:00.000Z' },
        es: null,
      });
      expect(replaced.status).toBe(200);
      expect(replaced.body.en).toEqual({
        file: spanish,
        assignedAt: '2026-02-01T00:00:00.000Z',
      });
      expect(again.status).toBe(200);
      expect(again.body).toEqual(replaced.body);
      expect(
        library.body.items.map((file: Uploaded) => file.id).sort(),
      ).toEqual([english.id, spanish.id].sort());
    });

    it('answers 404 for an unknown file and keeps the assignment (E4)', async () => {
      await assign('en', english.id);

      const response = await assign('en', UNKNOWN_ID);

      expect(response.status).toBe(404);
      expect(response.body).toEqual({ error: 'Not found.' });
      expect(prisma.resume.rows).toMatchObject([{ fileId: english.id }]);
    });

    it('answers 400 on fileId for a malformed id or an image (E4)', async () => {
      const image = await upload('photo.png', samples.png);

      const malformed = await assign('en', 'x');
      const missing = await server()
        .put('/resume/assignments/en')
        .set('Authorization', auth())
        .send({});
      const notPdf = await assign('en', image.id);

      for (const response of [malformed, missing, notPdf]) {
        expect(response.status).toBe(400);
        expect(Object.keys(response.body.fields)).toEqual(['fileId']);
      }
      expect(notPdf.body.error).toBe('The resume must be a PDF file.');
      expect(prisma.resume.rows).toEqual([]);
    });

    it('answers 400 on lang for a language other than en or es (E4)', async () => {
      const response = await assign('fr', english.id);

      expect(response.status).toBe(400);
      expect(response.body.error).toBe('Validation failed.');
      expect(Object.keys(response.body.fields)).toEqual(['lang']);
      expect(prisma.resume.rows).toEqual([]);
    });

    it('answers 409 to a Spanish resume without an English one (E5)', async () => {
      const response = await assign('es', spanish.id);

      expect(response.status).toBe(409);
      expect(response.body).toEqual({
        error: 'Assign an English resume first.',
      });
      expect(prisma.resume.rows).toEqual([]);
    });
  });

  describe('DELETE /resume/assignments/:lang (E6)', () => {
    it('clears Spanish twice with 204 and refuses English while Spanish exists', async () => {
      await assign('en', english.id);
      await assign('es', spanish.id);

      const blocked = await clear('en');
      const cleared = await clear('es');
      const again = await clear('es');

      expect(blocked.status).toBe(409);
      expect(blocked.body).toEqual({
        error: 'Clear the Spanish resume first.',
      });
      expect(cleared.status).toBe(204);
      expect(again.status).toBe(204);
      expect(prisma.resume.rows).toMatchObject([{ lang: 'en' }]);
      expect(prisma.file.rows).toHaveLength(2);
    });

    it('answers 400 on lang for another language', async () => {
      const response = await clear('fr');

      expect(response.status).toBe(400);
      expect(Object.keys(response.body.fields)).toEqual(['lang']);
    });
  });

  describe('GET /resume (E7, E8, E9)', () => {
    it('serves English by default, Spanish and the Spanish fallback (E7)', async () => {
      await assign('en', english.id);
      const fallback = await download('?lang=es');
      await assign('es', spanish.id);

      const byDefault = await download();
      const inEnglish = await download('?lang=en');
      const inSpanish = await download('?lang=es');

      for (const [response, bytes, name] of [
        [byDefault, ENGLISH_PDF, 'Marco%20CV.pdf'],
        [inEnglish, ENGLISH_PDF, 'Marco%20CV.pdf'],
        [fallback, ENGLISH_PDF, 'Marco%20CV.pdf'],
        [inSpanish, SPANISH_PDF, 'Marco%20CV%20%28es%29.pdf'],
      ] as const) {
        expect(response.status).toBe(200);
        expect(response.body).toEqual(bytes);
        expect(response.headers['content-type']).toBe('application/pdf');
        expect(response.headers['content-disposition']).toBe(
          `inline; filename*=UTF-8''${name}`,
        );
      }
    });

    it('answers 404 when nothing is assigned and 400 to another lang (E8)', async () => {
      const missing = await server().get('/resume');
      const french = await server().get('/resume?lang=fr');

      expect(missing.status).toBe(404);
      expect(missing.body).toEqual({ error: 'Not found.' });
      expect(french.status).toBe(400);
      expect(french.body.error).toBe('Validation failed.');
      expect(Object.keys(french.body.fields)).toEqual(['lang']);
    });

    it('sends the protective headers, revalidates with the ETag and serves a replacement at the same URL (E9)', async () => {
      await assign('en', english.id);

      const first = await download();
      const etag = first.headers.etag as string;
      const revalidated = await server()
        .get('/resume')
        .set('If-None-Match', etag);
      const newer = await upload('Marco CV v2.pdf', NEWER_PDF);
      await assign('en', newer.id);
      const replaced = await download().set('If-None-Match', etag);

      expect(first.headers).toMatchObject({
        'x-content-type-options': 'nosniff',
        'content-security-policy': expect.stringMatching(/sandbox$/),
        'cross-origin-resource-policy': 'cross-origin',
        'cache-control': 'no-cache',
      });
      expect(first.headers['cache-control']).not.toContain('immutable');
      expect(etag).toBeTruthy();
      expect(revalidated.status).toBe(304);
      expect(replaced.status).toBe(200);
      expect(replaced.body).toEqual(NEWER_PDF);
      expect(replaced.headers.etag).not.toBe(etag);
    });
  });
});
