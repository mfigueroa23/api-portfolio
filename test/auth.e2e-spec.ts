import { INestApplication } from '@nestjs/common';
import { JwtService } from '@nestjs/jwt';
import request from 'supertest';
import { App } from 'supertest/types.js';
import { PrismaFake } from './fakes/prisma.fake.js';
import { createTestApp } from './utils/create-test-app.js';
import { hashPassword } from './utils/hash-password.js';

const SECRET = 'e2e-jwt-secret-value';
const PASSWORD = 'e2e-admin-password';

describe('POST /auth/login (e2e)', () => {
  let app: INestApplication<App>;
  let prisma: PrismaFake;
  let passwordHash: string;

  beforeEach(async () => {
    ({ app, prisma } = await createTestApp());
    passwordHash = hashPassword(PASSWORD);
    await prisma.adminUser.create({
      data: { username: 'marco', passwordHash },
    });
    await prisma.property.create({
      data: { key: 'jwt_secret', value: SECRET },
    });
  });

  afterEach(async () => {
    await app.close();
  });

  function login(body: object | string, ip = '203.0.113.30') {
    return request(app.getHttpServer())
      .post('/auth/login')
      .set('CF-Connecting-IP', ip)
      .set('content-type', 'application/json')
      .send(typeof body === 'string' ? body : JSON.stringify(body));
  }

  it('answers 200 with a 1-hour token for the right credentials', async () => {
    const response = await login({ username: 'marco', password: PASSWORD });

    expect(response.status).toBe(200);
    expect(response.body).toEqual({
      accessToken: expect.any(String),
      expiresIn: 3600,
    });
    const payload = await new JwtService().verifyAsync<{
      sub: number;
      iat: number;
      exp: number;
    }>(response.body.accessToken, { secret: SECRET });
    expect(payload.exp - payload.iat).toBe(3600);
  });

  it.each([
    ['wrong password', { username: 'marco', password: 'nope' }],
    ['unknown user', { username: 'someone', password: PASSWORD }],
  ])('answers the same 401 for a %s', async (_label, body) => {
    const response = await login(body);

    expect(response.status).toBe(401);
    expect(response.body).toEqual({ error: 'Invalid credentials.' });
  });

  it('answers 400 with the invalid fields', async () => {
    const response = await login({ username: '' });

    expect(response.status).toBe(400);
    expect(response.body.error).toBe('Validation failed.');
    expect(Object.keys(response.body.fields).sort()).toEqual([
      'password',
      'username',
    ]);
  });

  it('answers 429 on the 6th attempt even with the right credentials', async () => {
    for (let i = 0; i < 5; i++) {
      expect(
        (await login({ username: 'marco', password: 'nope' })).status,
      ).toBe(401);
    }

    const sixth = await login({ username: 'marco', password: PASSWORD });

    expect(sixth.status).toBe(429);
    expect(sixth.body).toEqual({
      error: 'Too many attempts. Please try again later.',
    });
  });

  it('counts malformed bodies toward the limit', async () => {
    for (let i = 0; i < 5; i++) await login('{');

    expect(
      (await login({ username: 'marco', password: PASSWORD })).status,
    ).toBe(429);
  });

  it('answers 500 when jwt_secret is not configured', async () => {
    await prisma.property.delete({ where: { key: 'jwt_secret' } });

    const response = await login({ username: 'marco', password: PASSWORD });

    expect(response.status).toBe(500);
  });

  it('never returns the password, its hash or the signing key', async () => {
    const bodies = [
      await login({ username: 'marco', password: PASSWORD }),
      await login({ username: 'marco', password: 'nope' }),
      await login({ username: 1 }),
    ].map((response) => response.text);

    for (const body of bodies) {
      expect(body).not.toContain(PASSWORD);
      expect(body).not.toContain(passwordHash);
      expect(body).not.toContain(SECRET);
    }
  });
});
