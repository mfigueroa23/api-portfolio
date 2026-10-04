import { INestApplication } from '@nestjs/common';
import request from 'supertest';
import { App } from 'supertest/types.js';
import { createTestApp } from './utils/create-test-app.js';
import { ownerToken } from './utils/owner-token.js';

describe('POST /markdown/render (e2e)', () => {
  let app: INestApplication<App>;
  let token: string;

  beforeEach(async () => {
    const created = await createTestApp();
    app = created.app;
    token = await ownerToken(created.prisma);
  });

  afterEach(async () => {
    await app.close();
  });

  const render = (body: unknown, auth = true) => {
    const req = request(app.getHttpServer()).post('/markdown/render');
    return (auth ? req.set('Authorization', `Bearer ${token}`) : req).send(
      body as object,
    );
  };

  it('answers 401 without a token', async () => {
    const response = await render({ markdown: '## Hi' }, false);

    expect(response.status).toBe(401);
    expect(response.body).toEqual({ error: 'Unauthorized.' });
  });

  it('answers 200 with html, toc and reading time', async () => {
    const response = await render({
      markdown: '## Hello\n\nSome text.\n\n<script>x</script>',
    });

    expect(response.status).toBe(200);
    expect(response.body).toEqual({
      html: expect.stringContaining('<h2 id="hello">Hello</h2>'),
      toc: [{ level: 2, text: 'Hello', id: 'hello' }],
      readingMinutes: 1,
    });
    expect(response.body.html).not.toContain('<script>');
  });

  it('accepts a body of 100,000 multi-byte characters', async () => {
    const response = await render({ markdown: 'é'.repeat(100_000) });

    expect(response.status).toBe(200);
  });

  it('answers 400 when markdown is missing or too long', async () => {
    const missing = await render({});
    const tooLong = await render({ markdown: 'a'.repeat(100_001) });

    for (const response of [missing, tooLong]) {
      expect(response.status).toBe(400);
      expect(response.body.error).toBe('Validation failed.');
      expect(Object.keys(response.body.fields)).toEqual(['markdown']);
    }
  });
});
