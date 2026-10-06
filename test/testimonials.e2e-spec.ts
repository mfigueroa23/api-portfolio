import { BadGatewayException, INestApplication } from '@nestjs/common';
import request from 'supertest';
import { App } from 'supertest/types.js';
import { BrevoClient } from '../src/app/mail/brevo.client.js';
import { PrismaFake } from './fakes/prisma.fake.js';
import { createTestApp } from './utils/create-test-app.js';
import { ownerToken } from './utils/owner-token.js';

const BREVO_KEY = 'xkeysib-e2e-testimonial-key';
const SUCCESS = {
  message: 'Thanks! Your testimonial will appear once it has been reviewed.',
};
const INVALID = { error: 'Please fill in all the fields with valid values.' };
const TOO_MANY = { error: 'Too many submissions. Please try again later.' };
const UNAUTHORIZED = { error: 'Unauthorized.' };
const NOT_FOUND = { error: 'Not found.' };
const valid = {
  name: 'Ada Lovelace',
  role: 'Engineer at Acme',
  email: 'ada@example.com',
  testimonial: 'A pleasure to work with.',
};
const ownerItem = {
  quote: 'Great work.',
  author: 'Grace Hopper',
  role: 'Admiral',
};

describe('testimonials (e2e)', () => {
  let app: INestApplication<App>;
  let prisma: PrismaFake;
  let token: string;
  const sendEmail = vi.fn();

  beforeEach(async () => {
    sendEmail.mockReset().mockResolvedValue(undefined);
    ({ app, prisma } = await createTestApp((builder) =>
      builder.overrideProvider(BrevoClient).useValue({ sendEmail }),
    ));
    await prisma.property.create({
      data: { key: 'brevo_api_key', value: BREVO_KEY },
    });
    token = await ownerToken(prisma);
  });

  afterEach(async () => {
    await app.close();
  });

  const server = () => request(app.getHttpServer());
  const auth = () => `Bearer ${token}`;

  function submit(body: object | string, ip = '203.0.113.10') {
    return server()
      .post('/testimonials')
      .set('CF-Connecting-IP', ip)
      .set('content-type', 'application/json')
      .send(typeof body === 'string' ? body : JSON.stringify(body));
  }

  const publicList = async () =>
    (await server().get('/content/testimonials')).body as Record<
      string,
      unknown
    >[];

  describe('POST /testimonials (submission)', () => {
    it('stores a pending testimonial, answers 201 and keeps it off the public list', async () => {
      const response = await submit({
        ...valid,
        name: '  Ada Lovelace  ',
        extra: 'stripped',
      });

      expect(response.status).toBe(201);
      expect(response.body).toEqual(SUCCESS);
      expect(prisma.testimonial.rows).toEqual([
        expect.objectContaining({
          status: 'pending',
          author: 'Ada Lovelace',
          role: 'Engineer at Acme',
          quote: 'A pleasure to work with.',
          email: 'ada@example.com',
          language: 'en',
          notified: true,
          position: null,
        }),
      ]);
      expect(prisma.testimonial.rows[0]).not.toHaveProperty('extra');
      expect(await publicList()).toEqual([]);
    });

    it('emails the owner as "Portfolio Testimonials" with the visitor as reply-to', async () => {
      await submit(valid);

      expect(sendEmail).toHaveBeenCalledTimes(1);
      expect(sendEmail).toHaveBeenCalledWith(
        BREVO_KEY,
        expect.objectContaining({
          senderName: 'Portfolio Testimonials',
          replyTo: { name: 'Ada Lovelace', email: 'ada@example.com' },
          subject: 'New testimonial from Ada Lovelace',
        }),
      );
    });

    it.each([
      [
        'the provider fails',
        () =>
          sendEmail.mockRejectedValue(new BadGatewayException('Provider down')),
      ],
      [
        'the provider credential is missing',
        () => prisma.property.delete({ where: { key: 'brevo_api_key' } }),
      ],
    ])(
      'still answers 201 and marks the testimonial not notified when %s',
      async (_label, breakMail) => {
        await breakMail();

        const response = await submit(valid);

        expect(response.status).toBe(201);
        expect(response.body).toEqual(SUCCESS);
        expect(prisma.testimonial.rows).toEqual([
          expect.objectContaining({ status: 'pending', notified: false }),
        ]);
      },
    );

    it('discards a filled honeypot with the success answer, storing and sending nothing', async () => {
      const response = await submit({ name: '', website: 'http://spam.test' });

      expect(response.status).toBe(201);
      expect(response.body).toEqual(SUCCESS);
      expect(prisma.testimonial.rows).toEqual([]);
      expect(sendEmail).not.toHaveBeenCalled();
    });

    it.each([
      ['name missing', { ...valid, name: undefined }],
      ['name too long', { ...valid, name: 'a'.repeat(101) }],
      ['name with a line break', { ...valid, name: 'Ada\nLovelace' }],
      ['name made only of emoji', { ...valid, name: '😀😀' }],
      ['name made only of invisible characters', { ...valid, name: '​' }],
      ['role empty', { ...valid, role: '   ' }],
      ['role too long', { ...valid, role: 'a'.repeat(101) }],
      ['role with a line break', { ...valid, role: 'Eng\r\nineer' }],
      ['email invalid', { ...valid, email: 'ada@example' }],
      ['email too long', { ...valid, email: `${'a'.repeat(189)}@example.com` }],
      ['testimonial missing', { ...valid, testimonial: undefined }],
      ['testimonial too long', { ...valid, testimonial: 'a'.repeat(501) }],
      ['a field that is not text', { ...valid, name: 7 }],
    ])(
      'answers 400 with the generic message and stores nothing when %s',
      async (_label, body) => {
        const response = await submit(body);

        expect(response.status).toBe(400);
        expect(response.body).toEqual(INVALID);
        expect(prisma.testimonial.rows).toEqual([]);
        expect(sendEmail).not.toHaveBeenCalled();
      },
    );

    it('answers 400 with the generic message for a malformed JSON body', async () => {
      const response = await submit('{"name": "Ada",');

      expect(response.status).toBe(400);
      expect(response.body).toEqual(INVALID);
      expect(prisma.testimonial.rows).toEqual([]);
    });

    it('accepts a testimonial of exactly 500 characters with line breaks', async () => {
      const testimonial = `${'a'.repeat(249)}\n${'b'.repeat(250)}`;

      const response = await submit({ ...valid, testimonial });

      expect(response.status).toBe(201);
      expect(prisma.testimonial.rows[0].quote).toBe(testimonial);
    });
  });

  describe('rate limit', () => {
    it('counts stored, invalid, malformed and honeypot submissions and refuses the 4th', async () => {
      const statuses = [
        (await submit(valid)).status,
        (await submit({ ...valid, email: 'bad' })).status,
        (await submit({ ...valid, website: 'bot' })).status,
      ];
      expect(statuses).toEqual([201, 400, 201]);
      sendEmail.mockClear();

      const fourth = await submit(valid);

      expect(fourth.status).toBe(429);
      expect(fourth.body).toEqual(TOO_MANY);
      expect(prisma.testimonial.rows).toHaveLength(1);
      expect(sendEmail).not.toHaveBeenCalled();
      expect((await submit('not json')).status).toBe(429);
    });

    it('answers 429 to a honeypot submission after the limit', async () => {
      for (let i = 0; i < 3; i++) await submit(valid);

      const response = await submit({ ...valid, website: 'bot' });

      expect(response.status).toBe(429);
      expect(response.body).toEqual(TOO_MANY);
    });

    it('keeps a separate counter per IP and separate from the contact form', async () => {
      for (let i = 0; i < 3; i++) await submit(valid, '203.0.113.10');

      expect((await submit(valid, '198.51.100.20')).status).toBe(201);
      const contact = await server()
        .post('/contact')
        .set('CF-Connecting-IP', '203.0.113.10')
        .send({ name: 'Ada', email: 'ada@example.com', message: 'Hi' });
      expect(contact.status).toBe(200);
      expect(
        await prisma.rateLimitHit.count({
          where: { bucket: 'testimonial', ip: '203.0.113.10' },
        }),
      ).toBe(3);
    });
  });

  describe('public list', () => {
    it('treats rows that existed before Spec 004 as approved and public', async () => {
      await prisma.testimonial.create({
        data: { ...ownerItem, position: 0, avatar: 'https://x.test/a.png' },
      });

      expect(await publicList()).toEqual([
        expect.objectContaining({ ...ownerItem, position: 0 }),
      ]);
    });

    it('never returns the email or review fields', async () => {
      await prisma.testimonial.create({
        data: {
          ...ownerItem,
          position: 0,
          email: 'leak@example.com',
          language: 'en',
          submittedAt: new Date(),
        },
      });
      await submit(valid);

      const response = await server().get('/content/testimonials');

      expect(response.body).toHaveLength(1);
      expect(response.text).not.toContain('@example.com');
      for (const field of [
        'email',
        'language',
        'notified',
        'submittedAt',
        'status',
      ]) {
        expect(response.body[0]).not.toHaveProperty(field);
      }
    });
  });

  describe('review (owner)', () => {
    const pendingId = async (body: object = valid) => {
      await submit(body, `198.51.100.${prisma.testimonial.rows.length + 1}`);
      return prisma.testimonial.rows.at(-1)!.id as number;
    };

    it.each([
      ['GET', '/content/testimonials/all'],
      ['GET', '/content/testimonials/pending-count'],
      ['PUT', '/content/testimonials/1'],
      ['POST', '/content/testimonials/1/approve'],
      ['DELETE', '/content/testimonials/1'],
      ['POST', '/content/testimonials'],
    ])(
      'answers 401 to %s %s without a token and changes nothing',
      async (method, url) => {
        await pendingId();
        const before = structuredClone(prisma.testimonial.rows);

        const response = await server()
          [method.toLowerCase() as 'get' | 'put' | 'post' | 'delete'](url)
          .send(ownerItem);

        expect(response.status).toBe(401);
        expect(response.body).toEqual(UNAUTHORIZED);
        expect(prisma.testimonial.rows).toEqual(before);
      },
    );

    it('lists pending items first with their email, then approved ones', async () => {
      await server()
        .post('/content/testimonials')
        .set('Authorization', auth())
        .send(ownerItem);
      await pendingId();

      const response = await server()
        .get('/content/testimonials/all')
        .set('Authorization', auth());

      expect(response.status).toBe(200);
      expect(response.body).toMatchObject([
        {
          status: 'pending',
          email: 'ada@example.com',
          language: 'en',
          notified: true,
        },
        { status: 'approved', author: 'Grace Hopper' },
      ]);
      expect(response.body[0].submittedAt).toEqual(expect.any(String));
    });

    it('answers the number of pending items', async () => {
      await pendingId();
      await pendingId();

      const response = await server()
        .get('/content/testimonials/pending-count')
        .set('Authorization', auth());

      expect(response.status).toBe(200);
      expect(response.body).toEqual({ count: 2 });
    });

    it('saves edits to a pending item and keeps it pending', async () => {
      const id = await pendingId();

      const response = await server()
        .put(`/content/testimonials/${id}`)
        .set('Authorization', auth())
        .send({ ...ownerItem, quote: 'Edited.' });

      expect(response.status).toBe(200);
      expect(response.body).toMatchObject({
        quote: 'Edited.',
        status: 'pending',
        email: 'ada@example.com',
      });
      expect(await publicList()).toEqual([]);
    });

    it('answers 400 with field errors to an invalid approval and changes nothing', async () => {
      const id = await pendingId();
      const before = structuredClone(prisma.testimonial.rows);

      const response = await server()
        .post(`/content/testimonials/${id}/approve`)
        .set('Authorization', auth())
        .send({ ...ownerItem, quote: 'a'.repeat(501), role: 'a'.repeat(201) });

      expect(response.status).toBe(400);
      expect(Object.keys(response.body.fields).sort()).toEqual([
        'quote',
        'role',
      ]);
      expect(prisma.testimonial.rows).toEqual(before);
    });

    it('approves with the form values: first in the public list, email deleted', async () => {
      await server()
        .post('/content/testimonials')
        .set('Authorization', auth())
        .send({ ...ownerItem, author: 'Existing' });
      const id = await pendingId();

      const response = await server()
        .post(`/content/testimonials/${id}/approve`)
        .set('Authorization', auth())
        .send({ ...ownerItem, author: 'Ada Lovelace', quote: 'Edited.' });

      expect(response.status).toBe(200);
      expect(response.body).toMatchObject({
        id,
        status: 'approved',
        position: 0,
        email: null,
        quote: 'Edited.',
      });
      expect((await publicList()).map((row) => row.author)).toEqual([
        'Ada Lovelace',
        'Existing',
      ]);
      expect(JSON.stringify(prisma.testimonial.rows)).not.toContain(
        'ada@example.com',
      );
    });

    it('rejects (deletes) a pending item with 204, then answers 404', async () => {
      const id = await pendingId();

      const reject = await server()
        .delete(`/content/testimonials/${id}`)
        .set('Authorization', auth());
      const again = await server()
        .delete(`/content/testimonials/${id}`)
        .set('Authorization', auth());

      expect(reject.status).toBe(204);
      expect(prisma.testimonial.rows).toEqual([]);
      expect(again.status).toBe(404);
      expect(again.body).toEqual(NOT_FOUND);
    });

    it('answers 404 to the approval of a missing item', async () => {
      const response = await server()
        .post('/content/testimonials/999/approve')
        .set('Authorization', auth())
        .send(ownerItem);

      expect(response.status).toBe(404);
      expect(response.body).toEqual(NOT_FOUND);
    });

    it('creates an owner testimonial public, first and without review', async () => {
      await server()
        .post('/content/testimonials')
        .set('Authorization', auth())
        .send({ ...ownerItem, author: 'First' });

      const response = await server()
        .post('/content/testimonials')
        .set('Authorization', auth())
        .send({ ...ownerItem, author: 'Second', position: 7 });

      expect(response.status).toBe(201);
      expect(response.body).toMatchObject({
        status: 'approved',
        position: 0,
        avatar: null,
      });
      expect((await publicList()).map((row) => row.author)).toEqual([
        'Second',
        'First',
      ]);
    });

    it('accepts, changes and removes the photo of a testimonial', async () => {
      const created = await server()
        .post('/content/testimonials')
        .set('Authorization', auth())
        .send(ownerItem);
      const url = `/content/testimonials/${created.body.id}`;
      const put = (avatar: string) =>
        server()
          .put(url)
          .set('Authorization', auth())
          .send({ ...ownerItem, avatar });

      expect(
        (await put('https://api.figueroa-sanchez.com/files/a')).body,
      ).toMatchObject({ avatar: 'https://api.figueroa-sanchez.com/files/a' });
      expect((await put('')).body).toMatchObject({ avatar: null });
      expect((await put('/relative.png')).status).toBe(400);
    });
  });

  describe('Spanish (Spec 004 phase 3)', () => {
    const submitLang = (
      body: object | string,
      lang: string,
      ip = '203.0.113.40',
    ) =>
      server()
        .post(`/testimonials?lang=${lang}`)
        .set('CF-Connecting-IP', ip)
        .set('content-type', 'application/json')
        .send(typeof body === 'string' ? body : JSON.stringify(body));

    it('stores a Spanish submission as the Spanish role and quote and answers in Spanish', async () => {
      const response = await submitLang(valid, 'es');

      expect(response.status).toBe(201);
      expect(response.body).toEqual({
        message: '¡Gracias! Tu testimonio aparecerá cuando haya sido revisado.',
      });
      expect(prisma.testimonial.rows).toEqual([
        expect.objectContaining({
          language: 'es',
          role: null,
          quote: null,
          roleEs: 'Engineer at Acme',
          quoteEs: 'A pleasure to work with.',
        }),
      ]);
      expect(sendEmail).toHaveBeenCalledWith(
        BREVO_KEY,
        expect.objectContaining({
          subject: 'New testimonial from Ada Lovelace',
          text: expect.stringContaining('Language: Spanish') as string,
        }),
      );
    });

    it('answers invalid, malformed, honeypot and 429 in Spanish', async () => {
      const invalid = await submitLang({ ...valid, name: '' }, 'es');
      const malformed = await submitLang('{', 'es');
      const honeypot = await submitLang({ ...valid, website: 'x' }, 'es');
      const limited = await submitLang(valid, 'es');

      expect(invalid.status).toBe(400);
      expect(invalid.body).toEqual({
        error: 'Completa todos los campos con valores válidos.',
      });
      expect(malformed.body).toEqual(invalid.body);
      expect(honeypot.status).toBe(201);
      expect(honeypot.body).toEqual({
        message: '¡Gracias! Tu testimonio aparecerá cuando haya sido revisado.',
      });
      expect(limited.status).toBe(429);
      expect(limited.body).toEqual({
        error: 'Demasiados envíos. Inténtalo más tarde.',
      });
    });

    it.each(['fr', 'en'])('answers in English for lang=%s', async (lang) => {
      const response = await submitLang(valid, lang);

      expect(response.body).toEqual(SUCCESS);
      expect(prisma.testimonial.rows[0]).toMatchObject({
        language: 'en',
        role: 'Engineer at Acme',
        roleEs: null,
      });
    });

    it('refuses to approve a Spanish submission without English text, then approves it', async () => {
      await submitLang(valid, 'es');
      const { id } = prisma.testimonial.rows[0] as { id: number };
      const approve = (body: object) =>
        server()
          .post(`/content/testimonials/${id}/approve`)
          .set('Authorization', auth())
          .send(body);

      const refused = await approve({
        author: 'Ada Lovelace',
        quoteEs: 'Un placer.',
        roleEs: 'Ingeniera',
      });
      const approved = await approve({
        ...ownerItem,
        author: 'Ada Lovelace',
        quoteEs: 'Un placer.',
        roleEs: 'Ingeniera',
      });

      expect(refused.status).toBe(400);
      expect(Object.keys(refused.body.fields).sort()).toEqual([
        'quote',
        'role',
      ]);
      expect(approved.status).toBe(200);
      expect(
        (await server().get('/content/testimonials?lang=es')).body,
      ).toEqual([
        expect.objectContaining({
          quote: 'Un placer.',
          role: 'Ingeniera',
          lang: 'es',
        }),
      ]);
    });

    it('saves a pending Spanish submission without English text', async () => {
      await submitLang(valid, 'es');
      const { id } = prisma.testimonial.rows[0] as { id: number };

      const response = await server()
        .put(`/content/testimonials/${id}`)
        .set('Authorization', auth())
        .send({ author: 'Ada', quoteEs: 'Editado.', roleEs: 'Ingeniera' });

      expect(response.status).toBe(200);
      expect(response.body).toMatchObject({
        status: 'pending',
        quote: null,
        quoteEs: 'Editado.',
      });
    });

    it('lists testimonials for the owner with translated', async () => {
      await server()
        .post('/content/testimonials')
        .set('Authorization', auth())
        .send({ ...ownerItem, quoteEs: 'Gran trabajo.', roleEs: 'Almirante' });

      const response = await server()
        .get('/content/testimonials/all')
        .set('Authorization', auth());

      expect(response.body).toMatchObject([{ translated: true }]);
    });
  });
});
