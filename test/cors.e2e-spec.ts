import { INestApplication } from '@nestjs/common';
import request from 'supertest';
import { App } from 'supertest/types.js';
import { PrismaFake } from './fakes/prisma.fake.js';
import { createTestApp } from './utils/create-test-app.js';

const PRODUCTION = 'https://marco.figueroa-sanchez.com';
const LOCAL = 'http://localhost:4200';

describe('CORS from cors_origin (e2e)', () => {
  let app: INestApplication<App>;
  let prisma: PrismaFake;

  beforeEach(async () => {
    ({ app, prisma } = await createTestApp());
  });

  afterEach(async () => {
    await app.close();
  });

  const get = (origin?: string) => {
    const req = request(app.getHttpServer()).get('/content/technologies');
    return origin ? req.set('Origin', origin) : req;
  };

  it('allows the production origin seeded by the migration', async () => {
    const response = await get(PRODUCTION);

    expect(response.status).toBe(200);
    expect(response.headers['access-control-allow-origin']).toBe(PRODUCTION);
  });

  it('sends no header to an origin missing from the table', async () => {
    const response = await get(LOCAL);

    expect(response.headers['access-control-allow-origin']).toBeUndefined();
  });

  it('applies a newly enabled origin without a restart, and a disable too', async () => {
    const row = await prisma.corsOrigin.create({
      data: { origin: LOCAL, enabled: true },
    });
    expect((await get(LOCAL)).headers['access-control-allow-origin']).toBe(
      LOCAL,
    );

    await prisma.corsOrigin.update({
      where: { id: row.id },
      data: { enabled: false },
    });
    expect(
      (await get(LOCAL)).headers['access-control-allow-origin'],
    ).toBeUndefined();
  });

  it('serves requests without an Origin header normally, without CORS headers', async () => {
    const response = await get();

    expect(response.status).toBe(200);
    expect(response.headers['access-control-allow-origin']).toBeUndefined();
  });

  it('lists the contract methods and headers in a preflight for an enabled origin', async () => {
    const response = await request(app.getHttpServer())
      .options('/content/technologies/1')
      .set('Origin', PRODUCTION)
      .set('Access-Control-Request-Method', 'PUT')
      .set('Access-Control-Request-Headers', 'content-type,authorization');

    expect(response.headers['access-control-allow-origin']).toBe(PRODUCTION);
    expect(response.headers['access-control-allow-methods']).toBe(
      'GET,POST,PUT,DELETE',
    );
    expect(response.headers['access-control-allow-headers']).toBe(
      'content-type,authorization',
    );
  });
});
