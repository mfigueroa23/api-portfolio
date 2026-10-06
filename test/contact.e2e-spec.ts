import { BadGatewayException, INestApplication } from '@nestjs/common';
import request from 'supertest';
import { App } from 'supertest/types.js';
import { BrevoClient } from '../src/app/mail/brevo.client.js';
import { PrismaFake } from './fakes/prisma.fake.js';
import { createTestApp } from './utils/create-test-app.js';

const BREVO_KEY = 'xkeysib-e2e-secret-key';
const SUCCESS = {
  message: "Message sent successfully! I'll get back to you soon.",
};
const INVALID = { error: 'Please fill in all the fields with valid values.' };
const TOO_MANY = { error: 'Too many messages. Please try again later.' };
const valid = { name: 'Ada', email: 'ada@example.com', message: 'Hello Marco' };

describe('POST /contact (e2e)', () => {
  let app: INestApplication<App>;
  let prisma: PrismaFake;
  const sendEmail = vi.fn();

  beforeEach(async () => {
    sendEmail.mockReset().mockResolvedValue(undefined);
    ({ app, prisma } = await createTestApp((builder) =>
      builder.overrideProvider(BrevoClient).useValue({ sendEmail }),
    ));
    await prisma.property.create({
      data: { key: 'brevo_api_key', value: BREVO_KEY },
    });
  });

  afterEach(async () => {
    await app.close();
  });

  function post(body: object | string, ip = '203.0.113.10') {
    const req = request(app.getHttpServer())
      .post('/contact')
      .set('CF-Connecting-IP', ip)
      .set('content-type', 'application/json');
    return req.send(typeof body === 'string' ? body : JSON.stringify(body));
  }

  describe('responses', () => {
    it('sends the email and answers 200 with the success message', async () => {
      const response = await post({ ...valid, name: '  Ada  ', extra: 'x' });

      expect(response.status).toBe(200);
      expect(response.body).toEqual(SUCCESS);
      expect(sendEmail).toHaveBeenCalledTimes(1);
      expect(sendEmail).toHaveBeenCalledWith(
        BREVO_KEY,
        expect.objectContaining({
          replyTo: { name: 'Ada', email: 'ada@example.com' },
          subject: 'New portfolio message from Ada',
        }),
      );
    });

    it.each([
      ['name missing', { email: valid.email, message: valid.message }],
      ['name too long', { ...valid, name: 'a'.repeat(101) }],
      ['name not text', { ...valid, name: 7 }],
      ['email invalid', { ...valid, email: 'ada@example' }],
      ['email too long', { ...valid, email: `${'a'.repeat(189)}@example.com` }],
      ['message whitespace only', { ...valid, message: '   ' }],
      ['message too long', { ...valid, message: 'a'.repeat(5001) }],
    ])('answers 400 without sending when %s', async (_label, body) => {
      const response = await post(body);

      expect(response.status).toBe(400);
      expect(response.body).toEqual(INVALID);
      expect(sendEmail).not.toHaveBeenCalled();
    });

    it('answers 400 for a malformed JSON body', async () => {
      const response = await post('{"name": "Ada",');

      expect(response.status).toBe(400);
      expect(response.body).toEqual(INVALID);
      expect(sendEmail).not.toHaveBeenCalled();
    });

    it('silently discards a filled honeypot even when other fields are invalid', async () => {
      const response = await post({ name: '', website: 'http://spam.test' });

      expect(response.status).toBe(200);
      expect(response.body).toEqual(SUCCESS);
      expect(sendEmail).not.toHaveBeenCalled();
    });

    it('answers 500 without sending when the Brevo key is not configured', async () => {
      await prisma.property.delete({ where: { key: 'brevo_api_key' } });

      const response = await post(valid);

      expect(response.status).toBe(500);
      expect(response.body).toEqual({
        error: 'The contact service is not available.',
      });
      expect(sendEmail).not.toHaveBeenCalled();
    });

    it('answers 502 when Brevo fails', async () => {
      sendEmail.mockRejectedValue(
        new BadGatewayException(
          'Failed to send the message. Please try again later.',
        ),
      );

      const response = await post(valid);

      expect(response.status).toBe(502);
      expect(response.body).toEqual({
        error: 'Failed to send the message. Please try again later.',
      });
    });

    it('never returns the stored key in any response', async () => {
      const bodies = [
        await post(valid),
        await post({ ...valid, email: 'bad' }),
        await post('{'),
        await post({ ...valid, website: 'x' }),
      ].map((response) => response.text);
      sendEmail.mockRejectedValue(new Error('unexpected'));
      bodies.push((await post(valid, '198.51.100.1')).text);

      for (const body of bodies) expect(body).not.toContain(BREVO_KEY);
    });
  });

  describe('rate limit, client IP and CORS', () => {
    it('counts sent, invalid, malformed and honeypot submissions toward the limit', async () => {
      const statuses = [
        (await post(valid)).status,
        (await post({ ...valid, email: 'bad' })).status,
        (await post('not json')).status,
        (await post({ ...valid, website: 'bot' })).status,
        (await post(valid)).status,
      ];
      expect(statuses).toEqual([200, 400, 400, 200, 200]);
      sendEmail.mockClear();

      const sixth = await post(valid);

      expect(sixth.status).toBe(429);
      expect(sixth.body).toEqual(TOO_MANY);
      expect(sendEmail).not.toHaveBeenCalled();
    });

    it('keeps a separate counter per CF-Connecting-IP', async () => {
      for (let i = 0; i < 5; i++) await post(valid, '203.0.113.10');

      expect((await post(valid, '203.0.113.10')).status).toBe(429);
      expect((await post(valid, '198.51.100.20')).status).toBe(200);
    });

    it('stores the hits in the database', async () => {
      await post(valid, '203.0.113.10');

      expect(
        await prisma.rateLimitHit.count({
          where: { bucket: 'contact', ip: '203.0.113.10' },
        }),
      ).toBe(1);
    });

    it('allows CORS for the production origin', async () => {
      const response = await post(valid).set(
        'Origin',
        'https://marco.figueroa-sanchez.com',
      );

      expect(response.headers['access-control-allow-origin']).toBe(
        'https://marco.figueroa-sanchez.com',
      );
    });

    it('sends no CORS header to http://localhost:4200', async () => {
      const preflight = await request(app.getHttpServer())
        .options('/contact')
        .set('Origin', 'http://localhost:4200')
        .set('Access-Control-Request-Method', 'POST');
      const response = await post(valid).set('Origin', 'http://localhost:4200');

      expect(preflight.headers['access-control-allow-origin']).toBeUndefined();
      expect(response.headers['access-control-allow-origin']).toBeUndefined();
    });
  });
});
