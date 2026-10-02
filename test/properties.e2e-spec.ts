import { INestApplication } from '@nestjs/common';
import request from 'supertest';
import { App } from 'supertest/types.js';
import { PrismaFake } from './fakes/prisma.fake.js';
import { createTestApp } from './utils/create-test-app.js';

// Configuration values (the Brevo key, the JWT secret) are managed only with
// SQL: no route may read or change them.
describe('configuration endpoints (e2e)', () => {
  let app: INestApplication<App>;
  let prisma: PrismaFake;

  beforeEach(async () => {
    ({ app, prisma } = await createTestApp());
    await prisma.property.create({
      data: { key: 'brevo_api_key', value: 'properties-e2e-secret' },
    });
  });

  afterEach(async () => {
    await app.close();
  });

  const routes = ['/properties', '/property', '/properties/brevo_api_key'];
  const methods = ['get', 'post', 'put', 'delete'] as const;

  it.each(routes.flatMap((route) => methods.map((method) => [method, route])))(
    '%s %s answers 404 without the stored value',
    async (method, route) => {
      const response = await request(app.getHttpServer())
        [method as (typeof methods)[number]](route)
        .send({ key: 'brevo_api_key', value: 'changed' });

      expect(response.status).toBe(404);
      expect(response.text).not.toContain('properties-e2e-secret');
      expect(
        await prisma.property.findUnique({ where: { key: 'brevo_api_key' } }),
      ).toMatchObject({ value: 'properties-e2e-secret' });
    },
  );
});
