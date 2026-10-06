import {
  ArgumentsHost,
  BadRequestException,
  HttpException,
  HttpStatus,
  Logger,
  NotFoundException,
  UnauthorizedException,
} from '@nestjs/common';
import { Prisma } from '../../../generated/prisma/client.js';
import { HttpExceptionFilter } from './http-exception.filter.js';

function mockHost(
  request: { path: string; query: Record<string, unknown> } = {
    path: '/',
    query: {},
  },
) {
  const response = {
    status: vi.fn().mockReturnThis(),
    json: vi.fn().mockReturnThis(),
  };
  const host = {
    switchToHttp: () => ({
      getResponse: () => response,
      getRequest: () => request,
    }),
  } as unknown as ArgumentsHost;
  return { host, response };
}

describe('HttpExceptionFilter', () => {
  const filter = new HttpExceptionFilter();

  beforeEach(() => {
    vi.spyOn(Logger.prototype, 'error').mockImplementation(() => undefined);
  });

  afterEach(() => {
    vi.restoreAllMocks();
  });

  it('turns an HttpException message into { error }', () => {
    const { host, response } = mockHost();

    filter.catch(new UnauthorizedException('Invalid credentials.'), host);

    expect(response.status).toHaveBeenCalledWith(401);
    expect(response.json).toHaveBeenCalledWith({
      error: 'Invalid credentials.',
    });
  });

  it('keeps an explicit { error, fields } body', () => {
    const { host, response } = mockHost();
    const fields = { name: ['name must be a string'] };

    filter.catch(
      new BadRequestException({ error: 'Validation failed.', fields }),
      host,
    );

    expect(response.status).toHaveBeenCalledWith(400);
    expect(response.json).toHaveBeenCalledWith({
      error: 'Validation failed.',
      fields,
    });
  });

  it('uses the message of a plain string HttpException', () => {
    const { host, response } = mockHost();

    filter.catch(new HttpException('Too many.', 429), host);

    expect(response.status).toHaveBeenCalledWith(429);
    expect(response.json).toHaveBeenCalledWith({ error: 'Too many.' });
  });

  it('answers unknown routes with a 404 error body', () => {
    const { host, response } = mockHost();

    filter.catch(new NotFoundException('Cannot GET /properties'), host);

    expect(response.status).toHaveBeenCalledWith(404);
    expect(response.json).toHaveBeenCalledWith({
      error: 'Cannot GET /properties',
    });
  });

  it('maps Prisma P2025 (record not found) to 404 Not found.', () => {
    const { host, response } = mockHost();
    const error = new Prisma.PrismaClientKnownRequestError('missing', {
      code: 'P2025',
      clientVersion: 'test',
    });

    filter.catch(error, host);

    expect(response.status).toHaveBeenCalledWith(HttpStatus.NOT_FOUND);
    expect(response.json).toHaveBeenCalledWith({ error: 'Not found.' });
  });

  it('hides unknown errors behind a 500 without the stack trace', () => {
    const { host, response } = mockHost();
    const error = new Error('db password is hunter2');

    filter.catch(error, host);

    expect(response.status).toHaveBeenCalledWith(500);
    expect(response.json).toHaveBeenCalledWith({
      error: 'Internal server error.',
    });
    const body = JSON.stringify(response.json.mock.calls[0][0]);
    expect(body).not.toContain('hunter2');
    expect(body).not.toContain('at ');
  });

  const slugConflict = {
    error: 'This slug is already in use.',
    fields: { slug: ['This slug is already in use.'] },
  };

  it('maps a P2002 on slug (meta.target) to 409 with a slug field error', () => {
    const { host, response } = mockHost();
    const error = new Prisma.PrismaClientKnownRequestError('unique', {
      code: 'P2002',
      clientVersion: 'test',
      meta: { target: ['slug'] },
    });

    filter.catch(error, host);

    expect(response.status).toHaveBeenCalledWith(HttpStatus.CONFLICT);
    expect(response.json).toHaveBeenCalledWith(slugConflict);
  });

  it('maps a P2002 on slug reported by the pg driver adapter to 409', () => {
    const { host, response } = mockHost();
    // Shape PostgreSQL errors take through @prisma/adapter-pg (no target).
    const error = new Prisma.PrismaClientKnownRequestError('unique', {
      code: 'P2002',
      clientVersion: 'test',
      meta: {
        modelName: 'Post',
        driverAdapterError: {
          cause: {
            kind: 'UniqueConstraintViolation',
            constraint: { index: 'post_slug_key' },
          },
        },
      },
    });

    filter.catch(error, host);

    expect(response.status).toHaveBeenCalledWith(HttpStatus.CONFLICT);
    expect(response.json).toHaveBeenCalledWith(slugConflict);
  });

  it('treats a P2002 on another column as unknown', () => {
    const { host, response } = mockHost();
    const error = new Prisma.PrismaClientKnownRequestError('unique', {
      code: 'P2002',
      clientVersion: 'test',
      meta: {
        target: ['origin'],
        driverAdapterError: {
          cause: { constraint: { index: 'cors_origin_origin_key' } },
        },
      },
    });

    filter.catch(error, host);

    expect(response.status).toHaveBeenCalledWith(500);
  });

  it('treats Prisma errors other than P2025 as unknown', () => {
    const { host, response } = mockHost();
    const error = new Prisma.PrismaClientKnownRequestError('unique', {
      code: 'P2002',
      clientVersion: 'test',
    });

    filter.catch(error, host);

    expect(response.status).toHaveBeenCalledWith(500);
  });

  describe('Spanish URL slug conflicts (Spec 004)', () => {
    it.each([
      ['the fake target', { target: ['url_slug_es'] }],
      [
        'the pg driver adapter index',
        {
          driverAdapterError: {
            cause: { constraint: { index: 'post_url_slug_es_key' } },
          },
        },
      ],
    ])('maps a P2002 on %s to 409 on slugEs', (_label, meta) => {
      const { host, response } = mockHost();

      filter.catch(
        new Prisma.PrismaClientKnownRequestError('Unique', {
          code: 'P2002',
          clientVersion: Prisma.prismaVersion.client,
          meta,
        }),
        host,
      );

      expect(response.status).toHaveBeenCalledWith(409);
      expect(response.json).toHaveBeenCalledWith({
        error: 'This slug is already in use.',
        fields: { slugEs: ['This slug is already in use.'] },
      });
    });
  });

  describe('Spanish form messages (Spec 004)', () => {
    it.each([
      [
        400,
        'Please fill in all the fields with valid values.',
        'Completa todos los campos con valores válidos.',
      ],
      [
        429,
        'Too many messages. Please try again later.',
        'Demasiados mensajes. Inténtalo más tarde.',
      ],
      [
        500,
        'The contact service is not available.',
        'El servicio de contacto no está disponible.',
      ],
      [
        502,
        'Failed to send the message. Please try again later.',
        'No se pudo enviar el mensaje. Inténtalo más tarde.',
      ],
    ])(
      'translates a %i on /contact with lang=es',
      (status, english, spanish) => {
        const { host, response } = mockHost({
          path: '/contact',
          query: { lang: 'es' },
        });

        filter.catch(new HttpException(english, status), host);

        expect(response.status).toHaveBeenCalledWith(status);
        expect(response.json).toHaveBeenCalledWith({ error: spanish });
      },
    );

    it.each([
      [
        400,
        'Please fill in all the fields with valid values.',
        'Completa todos los campos con valores válidos.',
      ],
      [
        429,
        'Too many submissions. Please try again later.',
        'Demasiados envíos. Inténtalo más tarde.',
      ],
    ])(
      'translates a %i on /testimonials with lang=es',
      (status, english, spanish) => {
        const { host, response } = mockHost({
          path: '/testimonials',
          query: { lang: 'es' },
        });

        filter.catch(new HttpException(english, status), host);

        expect(response.json).toHaveBeenCalledWith({ error: spanish });
      },
    );

    it.each([
      ['/contact', {}],
      ['/contact', { lang: 'fr' }],
      ['/testimonials', { lang: 'en' }],
      ['/content/posts', { lang: 'es' }],
    ])('keeps English on %s with %j', (path, query) => {
      const { host, response } = mockHost({ path, query });

      filter.catch(
        new HttpException(
          'Please fill in all the fields with valid values.',
          400,
        ),
        host,
      );

      expect(response.json).toHaveBeenCalledWith({
        error: 'Please fill in all the fields with valid values.',
      });
    });

    it('leaves messages outside table K-1 unchanged', () => {
      const { host, response } = mockHost({
        path: '/contact',
        query: { lang: 'es' },
      });

      filter.catch(new NotFoundException('Not found.'), host);

      expect(response.json).toHaveBeenCalledWith({ error: 'Not found.' });
    });
  });
});
