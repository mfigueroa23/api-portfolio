import { INestApplication } from '@nestjs/common';
import request from 'supertest';
import { App } from 'supertest/types.js';
import { createTestApp } from './utils/create-test-app.js';

describe('Health (e2e)', () => {
  let app: INestApplication<App>;

  beforeEach(async () => {
    ({ app } = await createTestApp());
  });

  afterEach(async () => {
    await app.close();
  });

  it('GET / answers 200 with status ok', () => {
    return request(app.getHttpServer())
      .get('/')
      .expect(200)
      .expect({ status: 'ok' });
  });

  it('allows CORS for the production origin', async () => {
    const response = await request(app.getHttpServer())
      .get('/')
      .set('Origin', 'https://marco.figueroa-sanchez.com');

    expect(response.headers['access-control-allow-origin']).toBe(
      'https://marco.figueroa-sanchez.com',
    );
  });

  it('allows the methods and headers of the contract in preflight', async () => {
    const response = await request(app.getHttpServer())
      .options('/content/experiences')
      .set('Origin', 'https://marco.figueroa-sanchez.com')
      .set('Access-Control-Request-Method', 'PUT')
      .set('Access-Control-Request-Headers', 'content-type,authorization');

    expect(response.headers['access-control-allow-methods']).toBe(
      'GET,POST,PUT,DELETE',
    );
    expect(response.headers['access-control-allow-headers']).toBe(
      'content-type,authorization',
    );
  });

  it('sends no CORS header to other origins such as localhost', async () => {
    const response = await request(app.getHttpServer())
      .get('/')
      .set('Origin', 'http://localhost:4200');

    expect(response.headers['access-control-allow-origin']).toBeUndefined();
  });

  it('answers unknown routes with a JSON error body', async () => {
    const response = await request(app.getHttpServer()).get('/missing');

    expect(response.status).toBe(404);
    expect(response.body).toEqual({ error: 'Cannot GET /missing' });
  });
});
