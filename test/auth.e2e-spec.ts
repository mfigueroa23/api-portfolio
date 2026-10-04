import { INestApplication } from '@nestjs/common';
import { JwtService } from '@nestjs/jwt';
import request from 'supertest';
import { App } from 'supertest/types.js';
import { GoogleIdTokenClient } from '../src/app/auth/clients/google-id-token.client.js';
import { GoogleIdentity } from '../src/app/auth/interfaces/google-identity.interface.js';
import { PrismaFake } from './fakes/prisma.fake.js';
import { createTestApp } from './utils/create-test-app.js';

const SECRET = 'e2e-jwt-secret-value';
const CLIENT_ID = 'e2e-client-id.apps.googleusercontent.com';
const OWNER_EMAIL = 'owner@example.com';

// Stands in for Google: fixed credentials map to identities, anything else is
// an invalid, expired or foreign token.
const identities: Record<string, GoogleIdentity> = {
  good: { email: OWNER_EMAIL, emailVerified: true },
  other: { email: 'someone@example.com', emailVerified: true },
  unverified: { email: OWNER_EMAIL, emailVerified: false },
};

describe('POST /auth/google (e2e)', () => {
  let app: INestApplication<App>;
  let prisma: PrismaFake;
  const verify = vi.fn();

  beforeEach(async () => {
    verify
      .mockReset()
      .mockImplementation((idToken: string, clientId: string) =>
        Promise.resolve(
          clientId === CLIENT_ID ? (identities[idToken] ?? null) : null,
        ),
      );
    ({ app, prisma } = await createTestApp((builder) =>
      builder.overrideProvider(GoogleIdTokenClient).useValue({ verify }),
    ));
    for (const [key, value] of [
      ['jwt_secret', SECRET],
      ['google_client_id', CLIENT_ID],
      ['admin_google_email', OWNER_EMAIL],
    ]) {
      await prisma.property.create({ data: { key, value } });
    }
  });

  afterEach(async () => {
    await app.close();
  });

  function signIn(body: object | string, ip = '203.0.113.30') {
    return request(app.getHttpServer())
      .post('/auth/google')
      .set('CF-Connecting-IP', ip)
      .set('content-type', 'application/json')
      .send(typeof body === 'string' ? body : JSON.stringify(body));
  }

  it('answers 200 with a 1-hour token for the authorized account', async () => {
    const response = await signIn({ credential: 'good' });

    expect(response.status).toBe(200);
    expect(response.body).toEqual({
      accessToken: expect.any(String),
      expiresIn: 3600,
    });
    const payload = await new JwtService().verifyAsync<{
      sub: string;
      iat: number;
      exp: number;
    }>(response.body.accessToken, { secret: SECRET });
    expect(payload.sub).toBe('owner');
    expect(payload.exp - payload.iat).toBe(3600);
  });

  it.each([
    ['a missing credential', {}],
    ['an empty credential', { credential: '' }],
    ['a credential over 4096 characters', { credential: 'a'.repeat(4097) }],
  ])('answers 400 for %s', async (_label, body) => {
    const response = await signIn(body);

    expect(response.status).toBe(400);
    expect(response.body.error).toBe('Validation failed.');
    expect(Object.keys(response.body.fields)).toEqual(['credential']);
    expect(verify).not.toHaveBeenCalled();
  });

  it('answers 400 for invalid JSON', async () => {
    const response = await signIn('{');

    expect(response.status).toBe(400);
    expect(verify).not.toHaveBeenCalled();
  });

  it('answers 401 for a credential Google does not verify', async () => {
    const response = await signIn({ credential: 'forged' });

    expect(response.status).toBe(401);
    expect(response.body).toEqual({ error: 'Invalid Google sign-in.' });
  });

  it.each([
    ['another Google account', 'other'],
    ['an unverified email', 'unverified'],
  ])('answers 403 for %s', async (_label, credential) => {
    const response = await signIn({ credential });

    expect(response.status).toBe(403);
    expect(response.body).toEqual({
      error: 'This Google account is not authorized.',
    });
  });

  it.each(['google_client_id', 'admin_google_email'])(
    'answers 500 when %s is not configured',
    async (key) => {
      await prisma.property.delete({ where: { key } });

      const response = await signIn({ credential: 'good' });

      expect(response.status).toBe(500);
      expect(response.body).toEqual({ error: 'Sign-in is not available.' });
    },
  );

  it('answers 429 on the 6th attempt without checking the credential', async () => {
    for (let i = 0; i < 5; i++) {
      expect((await signIn({ credential: 'forged' })).status).toBe(401);
    }
    verify.mockClear();

    const sixth = await signIn({ credential: 'good' });

    expect(sixth.status).toBe(429);
    expect(sixth.body).toEqual({
      error: 'Too many attempts. Please try again later.',
    });
    expect(verify).not.toHaveBeenCalled();
  });

  it('no longer serves the password login', async () => {
    const response = await request(app.getHttpServer())
      .post('/auth/login')
      .set('content-type', 'application/json')
      .send(JSON.stringify({ username: 'marco', password: 'secret' }));

    expect(response.status).toBe(404);
  });

  it('issues a token that the content write endpoints accept', async () => {
    const { accessToken } = (await signIn({ credential: 'good' })).body as {
      accessToken: string;
    };

    const response = await request(app.getHttpServer())
      .post('/content/technologies')
      .set('Authorization', `Bearer ${accessToken}`)
      .send({ position: 0, name: 'TypeScript' });

    expect(response.status).toBe(201);
    expect(response.body).toMatchObject({ position: 0, name: 'TypeScript' });
  });

  it('never returns the credential or the signing key', async () => {
    const bodies = [
      await signIn({ credential: 'good' }),
      await signIn({ credential: 'forged' }),
      await signIn({ credential: 1 }),
    ].map((response) => response.text);

    for (const body of bodies) {
      expect(body).not.toContain('forged');
      expect(body).not.toContain(SECRET);
    }
  });
});
