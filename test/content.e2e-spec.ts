import { INestApplication } from '@nestjs/common';
import { JwtService } from '@nestjs/jwt';
import request from 'supertest';
import { App } from 'supertest/types.js';
import { PrismaFake } from './fakes/prisma.fake.js';
import { createTestApp } from './utils/create-test-app.js';

const SECRET = 'content-e2e-jwt-secret';
const UNAUTHORIZED = { error: 'Unauthorized.' };
const NOT_FOUND = { error: 'Not found.' };

type Model = Exclude<
  keyof PrismaFake,
  '$connect' | '$disconnect' | '$transaction'
>;

interface Collection {
  path: string;
  model: Model;
  item: Record<string, unknown>;
  textField: string;
  requiredFields: string[];
  tooLong: { field: string; max: number };
}

const collections: Collection[] = [
  {
    path: 'experiences',
    model: 'experience',
    item: {
      position: 0,
      period: 'Jan 2026 — Present',
      role: 'Engineer',
      company: 'Acme',
      description: 'Builds things.',
      technologies: ['TypeScript', 'NestJS'],
      current: true,
    },
    textField: 'period',
    requiredFields: [
      'position',
      'period',
      'role',
      'company',
      'description',
      'technologies',
      'current',
    ],
    tooLong: { field: 'period', max: 100 },
  },
  {
    path: 'projects',
    model: 'project',
    item: {
      position: 0,
      title: 'Portfolio',
      description: 'Personal site.',
      image: '/projects/portfolio.png',
      tags: ['Angular'],
      link: 'https://example.com',
      github: 'https://github.com/example/portfolio',
    },
    textField: 'title',
    requiredFields: [
      'position',
      'title',
      'description',
      'image',
      'tags',
      'link',
      'github',
    ],
    tooLong: { field: 'title', max: 200 },
  },
  {
    path: 'testimonials',
    model: 'testimonial',
    item: {
      position: 0,
      quote: 'Great work.',
      author: 'Grace Hopper',
      role: 'Admiral',
      avatar: '/avatars/grace.png',
    },
    textField: 'quote',
    requiredFields: ['position', 'quote', 'author', 'role', 'avatar'],
    tooLong: { field: 'author', max: 200 },
  },
  {
    path: 'highlights',
    model: 'highlight',
    item: {
      position: 0,
      icon: 'fa-solid fa-code',
      title: 'Clean Code',
      description: 'Readable code.',
    },
    textField: 'icon',
    requiredFields: ['position', 'icon', 'title', 'description'],
    tooLong: { field: 'icon', max: 100 },
  },
  {
    path: 'social-links',
    model: 'socialLink',
    item: {
      position: 0,
      icon: 'fa-brands fa-github',
      href: 'https://github.com/example',
    },
    textField: 'icon',
    requiredFields: ['position', 'icon', 'href'],
    tooLong: { field: 'icon', max: 100 },
  },
  {
    path: 'technologies',
    model: 'technology',
    item: {
      position: 0,
      name: 'Angular',
    },
    textField: 'name',
    requiredFields: ['position', 'name'],
    tooLong: { field: 'name', max: 100 },
  },
  {
    path: 'contact-info',
    model: 'contactInfo',
    item: {
      position: 0,
      icon: 'fa-solid fa-envelope',
      label: 'Email',
      value: 'me@example.com',
      href: 'mailto:me@example.com',
    },
    textField: 'icon',
    requiredFields: ['position', 'icon', 'label', 'value', 'href'],
    tooLong: { field: 'icon', max: 100 },
  },
];

describe.each(collections)(
  '/content/$path (e2e)',
  ({ path, model, item, textField, requiredFields, tooLong }) => {
    let app: INestApplication<App>;
    let prisma: PrismaFake;
    let token: string;
    const url = `/content/${path}`;

    beforeEach(async () => {
      ({ app, prisma } = await createTestApp());
      await prisma.property.create({
        data: { key: 'jwt_secret', value: SECRET },
      });
      token = await new JwtService().signAsync(
        { sub: 1 },
        { secret: SECRET, expiresIn: '1h' },
      );
    });

    afterEach(async () => {
      await app.close();
    });

    const server = () => request(app.getHttpServer());
    const seed = (data: Record<string, unknown>) =>
      prisma[model].create({ data: { ...item, ...data } });

    describe('GET (public)', () => {
      it('returns an empty array for an empty collection', async () => {
        const response = await server().get(url);

        expect(response.status).toBe(200);
        expect(response.body).toEqual([]);
      });

      it('returns every item ordered by position, then id', async () => {
        for (const position of [2, 0, 2, 1]) await seed({ position });

        const response = await server().get(url);

        expect(response.status).toBe(200);
        expect(response.body.map((row: { id: number }) => row.id)).toEqual([
          2, 4, 1, 3,
        ]);
        expect(response.body[0]).toMatchObject({ ...item, position: 0 });
      });
    });

    describe('without a valid token', () => {
      it.each([
        ['no token', undefined],
        ['a malformed token', 'Bearer nope'],
        ['another scheme', `Basic abc`],
      ])(
        'answers 401 to writes with %s and changes nothing',
        async (_l, auth) => {
          const existing = await seed({});
          const withAuth = (req: request.Test) =>
            auth ? req.set('Authorization', auth) : req;

          const responses = [
            await withAuth(server().post(url)).send(item),
            await withAuth(server().put(`${url}/${existing.id}`)).send({
              ...item,
              [textField]: 'Changed',
            }),
            await withAuth(server().delete(`${url}/${existing.id}`)),
          ];

          for (const response of responses) {
            expect(response.status).toBe(401);
            expect(response.body).toEqual(UNAUTHORIZED);
          }
          expect(await prisma[model].findMany()).toEqual([existing]);
        },
      );

      it('answers 401 to an expired token', async () => {
        const expired = await new JwtService().signAsync(
          { sub: 1, exp: Math.floor(Date.now() / 1000) - 10 },
          { secret: SECRET },
        );

        const response = await server()
          .post(url)
          .set('Authorization', `Bearer ${expired}`)
          .send(item);

        expect(response.status).toBe(401);
        expect(await prisma[model].count()).toBe(0);
      });
    });

    describe('with a valid token', () => {
      const auth = () => `Bearer ${token}`;

      it('creates an item and answers 201 with it', async () => {
        const response = await server()
          .post(url)
          .set('Authorization', auth())
          .send({ ...item, unknownField: 'stripped' });

        expect(response.status).toBe(201);
        expect(response.body).toMatchObject({ id: 1, ...item });
        expect(response.body).not.toHaveProperty('unknownField');
        expect(await prisma[model].findMany()).toEqual([
          expect.objectContaining(item),
        ]);
      });

      it('updates an item and answers 200 with it', async () => {
        const existing = await seed({});

        const response = await server()
          .put(`${url}/${existing.id}`)
          .set('Authorization', auth())
          .send({ ...item, [textField]: 'Updated' });

        expect(response.status).toBe(200);
        expect(response.body).toMatchObject({
          id: existing.id,
          [textField]: 'Updated',
        });
        expect(await prisma[model].findMany()).toEqual([
          expect.objectContaining({ [textField]: 'Updated' }),
        ]);
      });

      it('deletes an item and answers 204', async () => {
        const existing = await seed({});

        const response = await server()
          .delete(`${url}/${existing.id}`)
          .set('Authorization', auth());

        expect(response.status).toBe(204);
        expect(await prisma[model].count()).toBe(0);
      });

      it('answers 400 listing every missing field and stores nothing', async () => {
        const response = await server()
          .post(url)
          .set('Authorization', auth())
          .send({});

        expect(response.status).toBe(400);
        expect(response.body.error).toBe('Validation failed.');
        expect(Object.keys(response.body.fields).sort()).toEqual(
          [...requiredFields].sort(),
        );
        expect(await prisma[model].count()).toBe(0);
      });

      it('answers 400 for a too long text and a negative position', async () => {
        const existing = await seed({});

        const response = await server()
          .put(`${url}/${existing.id}`)
          .set('Authorization', auth())
          .send({
            ...item,
            position: -1,
            [tooLong.field]: 'a'.repeat(tooLong.max + 1),
          });

        expect(response.status).toBe(400);
        expect(Object.keys(response.body.fields).sort()).toEqual(
          ['position', tooLong.field].sort(),
        );
        expect(await prisma[model].findMany()).toEqual([existing]);
      });

      it('answers 404 when updating or deleting a missing item', async () => {
        const update = await server()
          .put(`${url}/999`)
          .set('Authorization', auth())
          .send(item);
        const remove = await server()
          .delete(`${url}/999`)
          .set('Authorization', auth());

        expect(update.status).toBe(404);
        expect(update.body).toEqual(NOT_FOUND);
        expect(remove.status).toBe(404);
        expect(remove.body).toEqual(NOT_FOUND);
      });

      it('answers 400 for a non-numeric id', async () => {
        const response = await server()
          .delete(`${url}/abc`)
          .set('Authorization', auth());

        expect(response.status).toBe(400);
      });
    });
  },
);
