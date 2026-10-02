import { HttpException, Logger } from '@nestjs/common';
import { JwtService } from '@nestjs/jwt';
import { hashPassword } from '../../../test/utils/hash-password.js';
import { PrismaService } from '../database/prisma.service.js';
import { PropertiesService } from '../properties/properties.service.js';
import { AuthService } from './auth.service.js';
import { JwtPayload } from './interfaces/jwt-payload.interface.js';

const SECRET = 'unit-test-jwt-secret';

describe('AuthService', () => {
  const jwt = new JwtService();
  const findUnique = vi.fn();
  const get = vi.fn();
  const service = new AuthService(
    { adminUser: { findUnique } } as unknown as PrismaService,
    { get } as unknown as PropertiesService,
    jwt,
  );
  const admin = {
    id: 1,
    username: 'marco',
    passwordHash: hashPassword('s3cret'),
  };

  beforeEach(() => {
    findUnique.mockReset();
    get
      .mockReset()
      .mockImplementation((key: string) =>
        Promise.resolve(key === 'jwt_secret' ? SECRET : null),
      );
    vi.spyOn(Logger.prototype, 'error').mockImplementation(() => undefined);
  });

  afterEach(() => {
    vi.restoreAllMocks();
  });

  async function rejection(promise: Promise<unknown>) {
    const error = (await promise.catch((e: unknown) => e)) as HttpException;
    expect(error).toBeInstanceOf(HttpException);
    return { status: error.getStatus(), body: error.getResponse() };
  }

  it('returns a token signed with jwt_secret that expires after 1 hour', async () => {
    findUnique.mockResolvedValue(admin);

    const result = await service.login({
      username: 'marco',
      password: 's3cret',
    });

    expect(findUnique).toHaveBeenCalledWith({ where: { username: 'marco' } });
    expect(result.expiresIn).toBe(3600);
    const payload = await jwt.verifyAsync<
      JwtPayload & { iat: number; exp: number }
    >(result.accessToken, { secret: SECRET });
    expect(payload.sub).toBe(1);
    expect(payload.exp - payload.iat).toBe(3600);
  });

  it('answers the same 401 for an unknown user and a wrong password', async () => {
    findUnique.mockResolvedValueOnce(null).mockResolvedValueOnce(admin);

    const unknownUser = await rejection(
      service.login({ username: 'nobody', password: 's3cret' }),
    );
    const wrongPassword = await rejection(
      service.login({ username: 'marco', password: 'wrong' }),
    );

    expect(unknownUser.status).toBe(401);
    expect(unknownUser).toEqual(wrongPassword);
    expect(JSON.stringify(unknownUser.body)).toContain('Invalid credentials.');
  });

  it('answers 500 when jwt_secret is not configured', async () => {
    findUnique.mockResolvedValue(admin);
    get.mockResolvedValue(null);

    const { status } = await rejection(
      service.login({ username: 'marco', password: 's3cret' }),
    );

    expect(status).toBe(500);
  });
});
