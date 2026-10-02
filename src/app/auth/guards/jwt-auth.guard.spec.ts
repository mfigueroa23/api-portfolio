import { ExecutionContext, HttpException } from '@nestjs/common';
import { JwtService } from '@nestjs/jwt';
import { PropertiesService } from '../../properties/properties.service.js';
import { JwtAuthGuard } from './jwt-auth.guard.js';

const SECRET = 'guard-test-secret';

function contextWith(authorization?: string): ExecutionContext {
  const headers = authorization === undefined ? {} : { authorization };
  return {
    switchToHttp: () => ({ getRequest: () => ({ headers }) }),
  } as unknown as ExecutionContext;
}

describe('JwtAuthGuard', () => {
  const jwt = new JwtService();
  const get = vi.fn();
  const guard = new JwtAuthGuard(jwt, { get } as unknown as PropertiesService);

  beforeEach(() => {
    get.mockReset().mockResolvedValue(SECRET);
  });

  afterEach(() => {
    vi.useRealTimers();
  });

  async function statusFor(authorization?: string) {
    const error = (await guard
      .canActivate(contextWith(authorization))
      .catch((e: unknown) => e)) as HttpException;
    expect(error).toBeInstanceOf(HttpException);
    return { status: error.getStatus(), message: error.message };
  }

  it('lets a valid bearer token through', async () => {
    const token = await jwt.signAsync(
      { sub: 1 },
      { secret: SECRET, expiresIn: '1h' },
    );

    await expect(
      guard.canActivate(contextWith(`Bearer ${token}`)),
    ).resolves.toBe(true);
  });

  it('rejects a request without a token', async () => {
    expect(await statusFor()).toEqual({
      status: 401,
      message: 'Unauthorized.',
    });
  });

  it.each(['Basic abc', 'Bearer', 'Bearer ', 'token-without-scheme'])(
    'rejects a header that is not "Bearer <token>" (%j)',
    async (header) => {
      expect(await statusFor(header)).toEqual({
        status: 401,
        message: 'Unauthorized.',
      });
    },
  );

  it('rejects an expired token', async () => {
    vi.useFakeTimers({ now: new Date('2026-10-01T10:00:00Z') });
    const token = await jwt.signAsync(
      { sub: 1 },
      { secret: SECRET, expiresIn: '1h' },
    );
    vi.setSystemTime(new Date('2026-10-01T11:00:01Z'));

    expect(await statusFor(`Bearer ${token}`)).toEqual({
      status: 401,
      message: 'Unauthorized.',
    });
  });

  it('rejects a token signed with another key', async () => {
    const token = await jwt.signAsync(
      { sub: 1 },
      { secret: 'other', expiresIn: '1h' },
    );

    expect(await statusFor(`Bearer ${token}`)).toEqual({
      status: 401,
      message: 'Unauthorized.',
    });
  });

  it('rejects a malformed token', async () => {
    expect((await statusFor('Bearer not.a.jwt')).status).toBe(401);
  });

  it('answers 500 when jwt_secret is not configured', async () => {
    const token = await jwt.signAsync(
      { sub: 1 },
      { secret: SECRET, expiresIn: '1h' },
    );
    get.mockResolvedValue(null);

    expect((await statusFor(`Bearer ${token}`)).status).toBe(500);
  });
});
