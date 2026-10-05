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
  // Values for columns with a unique index, so seeded rows do not collide.
  uniqueFields?: (n: number) => Record<string, unknown>;
  // How the database holds `item` (dates as Date), when it differs.
  row?: Record<string, unknown>;
  // Rows seeded for the public list, the ids it must return in order and
  // what its first item looks like. Defaults to the `position` order.
  order?: {
    seeds: Record<string, unknown>[];
    ids: number[];
    first: Record<string, unknown>;
  };
  // Collections without `position` only check the too long text.
  positioned?: boolean;
}

const at = (iso: string) => new Date(iso);

const collections: Collection[] = [
  {
    path: 'experiences',
    model: 'experience',
    item: {
      period: 'Jan 2026 — Present',
      role: 'Engineer',
      company: 'Acme',
      description: 'Builds things.',
      technologies: ['TypeScript', 'NestJS'],
      current: true,
      startDate: '2026-01',
      body: '## Highlights',
    },
    row: {
      period: 'Jan 2026 — Present',
      role: 'Engineer',
      company: 'Acme',
      description: 'Builds things.',
      technologies: ['TypeScript', 'NestJS'],
      current: true,
      startDate: at('2026-01-01'),
      body: '## Highlights',
    },
    textField: 'period',
    requiredFields: [
      'period',
      'role',
      'company',
      'description',
      'technologies',
      'current',
      'startDate',
    ],
    tooLong: { field: 'period', max: 100 },
    positioned: false,
    // Current first, then start date descending, undated last, then id.
    order: {
      seeds: [
        { current: false, startDate: at('2020-01-01') },
        { current: false, startDate: null },
        { current: true, startDate: at('2023-05-01') },
        { current: false, startDate: at('2024-03-01') },
        { current: false, startDate: at('2024-03-01') },
      ],
      ids: [3, 4, 5, 1, 2],
      first: {
        id: 3,
        role: 'Engineer',
        current: true,
        startDate: '2023-05',
        bodyHtml: '<h2 id="highlights">Highlights</h2>\n',
      },
    },
  },
  {
    path: 'projects',
    model: 'project',
    item: {
      slug: 'portfolio',
      title: 'Portfolio',
      description: 'Personal site.',
      image: '/projects/portfolio.png',
      tags: ['Angular'],
      link: 'https://example.com',
      github: 'https://github.com/example/portfolio',
    },
    textField: 'title',
    requiredFields: ['slug', 'title'],
    tooLong: { field: 'title', max: 200 },
    uniqueFields: (n) => ({ slug: `seeded-${n}` }),
    positioned: false,
    // Published only, newest publication first, then id descending.
    order: {
      seeds: [
        { status: 'published', publishedAt: at('2025-01-01T00:00:00Z') },
        { status: 'draft', publishedAt: null },
        { status: 'published', publishedAt: at('2026-01-01T00:00:00Z') },
        { status: 'published', publishedAt: at('2025-01-01T00:00:00Z') },
      ],
      ids: [3, 4, 1],
      first: { id: 3, slug: 'seeded-3', title: 'Portfolio' },
    },
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
  {
    path: 'certifications',
    model: 'certification',
    item: {
      position: 0,
      name: 'AWS Solutions Architect',
      issuer: 'Amazon',
      issueDate: '2025-03-14',
      expiryDate: '2028-03-14',
      credentialId: 'ABC-123',
      verificationUrl: 'https://verify.example.com/ABC-123',
      fileUrl: 'https://api.figueroa-sanchez.com/files/1',
    },
    row: {
      position: 0,
      name: 'AWS Solutions Architect',
      issuer: 'Amazon',
      issueDate: at('2025-03-14'),
      expiryDate: at('2028-03-14'),
      credentialId: 'ABC-123',
      verificationUrl: 'https://verify.example.com/ABC-123',
      fileUrl: 'https://api.figueroa-sanchez.com/files/1',
    },
    textField: 'name',
    requiredFields: ['position', 'name', 'issuer', 'issueDate'],
    tooLong: { field: 'name', max: 200 },
  },
];

describe.each(collections)(
  '/content/$path (e2e)',
  ({
    path,
    model,
    item,
    textField,
    requiredFields,
    tooLong,
    uniqueFields,
    order,
    positioned = true,
    row = item,
  }) => {
    let app: INestApplication<App>;
    let prisma: PrismaFake;
    let token: string;
    let seeded = 0;
    const url = `/content/${path}`;

    beforeEach(async () => {
      seeded = 0;
      ({ app, prisma } = await createTestApp());
      await prisma.property.create({
        data: { key: 'jwt_secret', value: SECRET },
      });
      token = await new JwtService().signAsync(
        { sub: 'owner' },
        { secret: SECRET, expiresIn: '1h' },
      );
    });

    afterEach(async () => {
      await app.close();
    });

    const server = () => request(app.getHttpServer());
    const seed = (data: Record<string, unknown>) =>
      prisma[model].create({
        data: { ...row, ...uniqueFields?.(++seeded), ...data },
      });

    describe('GET (public)', () => {
      it('returns an empty array for an empty collection', async () => {
        const response = await server().get(url);

        expect(response.status).toBe(200);
        expect(response.body).toEqual([]);
      });

      it('returns every item in display order', async () => {
        const seeds =
          order?.seeds ??
          [2, 0, 2, 1].map(
            (position) => ({ position }) as Record<string, unknown>,
          );
        for (const data of seeds) await seed(data);

        const response = await server().get(url);

        expect(response.status).toBe(200);
        expect(response.body.map((row: { id: number }) => row.id)).toEqual(
          order?.ids ?? [2, 4, 1, 3],
        );
        expect(response.body[0]).toMatchObject(
          order?.first ?? { ...item, position: 0 },
        );
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
          { sub: 'owner', exp: Math.floor(Date.now() / 1000) - 10 },
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
          .send({
            ...item,
            unknownField: 'stripped',
            // Projects and experience no longer have a position.
            ...(positioned ? {} : { position: 5 }),
          });

        expect(response.status).toBe(201);
        expect(response.body).toMatchObject({ id: 1, ...item });
        expect(response.body).not.toHaveProperty('unknownField');
        if (!positioned) expect(response.body).not.toHaveProperty('position');
        expect(await prisma[model].findMany()).toEqual([
          expect.objectContaining(row),
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

      it('answers 400 for a too long text (and a negative position)', async () => {
        const existing = await seed({});

        const response = await server()
          .put(`${url}/${existing.id}`)
          .set('Authorization', auth())
          .send({
            ...item,
            ...(positioned ? { position: -1 } : {}),
            [tooLong.field]: 'a'.repeat(tooLong.max + 1),
          });

        expect(response.status).toBe(400);
        expect(Object.keys(response.body.fields).sort()).toEqual(
          [...(positioned ? ['position'] : []), tooLong.field].sort(),
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

describe('collection-specific validation (e2e)', () => {
  let app: INestApplication<App>;
  let prisma: PrismaFake;
  let token: string;

  beforeEach(async () => {
    ({ app, prisma } = await createTestApp());
    await prisma.property.create({
      data: { key: 'jwt_secret', value: SECRET },
    });
    token = await new JwtService().signAsync(
      { sub: 'owner' },
      { secret: SECRET, expiresIn: '1h' },
    );
  });

  afterEach(async () => {
    await app.close();
  });

  const post = (path: string, body: object) =>
    request(app.getHttpServer())
      .post(`/content/${path}`)
      .set('Authorization', `Bearer ${token}`)
      .send(body);

  describe('experiences', () => {
    const entry = {
      period: 'Jan 2026 — Present',
      role: 'Engineer',
      company: 'Acme',
      description: 'Builds things.',
      technologies: [],
      current: false,
    };

    it.each([
      ['missing', undefined],
      ['month 13', '2026-13'],
      ['a full date', '2026-01-15'],
      ['a one-digit month', '2026-1'],
    ])('answers 400 for a %s start date', async (_label, startDate) => {
      const response = await post('experiences', { ...entry, startDate });

      expect(response.status).toBe(400);
      expect(Object.keys(response.body.fields)).toEqual(['startDate']);
    });

    it('stores the 1st of the month and returns YYYY-MM', async () => {
      const response = await post('experiences', {
        ...entry,
        startDate: '2024-02',
      });

      expect(response.status).toBe(201);
      expect(response.body.startDate).toBe('2024-02');
      expect(prisma.experience.rows[0].startDate).toEqual(
        new Date('2024-02-01T00:00:00Z'),
      );
    });

    it('lists current entries first and entries without a date last', async () => {
      await prisma.experience.create({
        data: { ...entry, role: 'Old', startDate: null },
      });
      await post('experiences', {
        ...entry,
        role: 'Past',
        startDate: '2020-01',
      });
      await post('experiences', {
        ...entry,
        role: 'Now',
        current: true,
        startDate: '2019-01',
      });

      const response = await request(app.getHttpServer()).get(
        '/content/experiences',
      );

      expect(
        response.body.map((row: { role: string; startDate: string | null }) => [
          row.role,
          row.startDate,
        ]),
      ).toEqual([
        ['Now', '2019-01'],
        ['Past', '2020-01'],
        ['Old', null],
      ]);
    });
  });

  describe('certifications', () => {
    const certification = {
      position: 0,
      name: 'CKA',
      issuer: 'CNCF',
      issueDate: '2025-03-14',
    };

    it('answers 400 on expiryDate when it is before the issue date', async () => {
      const response = await post('certifications', {
        ...certification,
        expiryDate: '2025-03-13',
      });

      expect(response.status).toBe(400);
      expect(Object.keys(response.body.fields)).toEqual(['expiryDate']);
      expect(prisma.certification.rows).toEqual([]);
    });

    it('accepts an expiry date equal to the issue date', async () => {
      const response = await post('certifications', {
        ...certification,
        expiryDate: '2025-03-14',
      });

      expect(response.status).toBe(201);
    });

    it('returns dates as YYYY-MM-DD and an absent expiry as null', async () => {
      await post('certifications', certification);

      const response = await request(app.getHttpServer()).get(
        '/content/certifications',
      );

      expect(response.body[0]).toMatchObject({
        issueDate: '2025-03-14',
        expiryDate: null,
        credentialId: null,
        verificationUrl: null,
        fileUrl: null,
      });
    });

    it.each([
      ['issueDate', '2025-02-30'],
      ['issueDate', '2025-03-14T00:00:00Z'],
      ['expiryDate', '14/03/2026'],
      ['verificationUrl', 'javascript:alert(1)'],
      ['fileUrl', '/files/1'],
    ])('answers 400 for %s = %s', async (field, value) => {
      const response = await post('certifications', {
        ...certification,
        [field]: value,
      });

      expect(response.status).toBe(400);
      expect(Object.keys(response.body.fields)).toEqual([field]);
    });
  });
});
