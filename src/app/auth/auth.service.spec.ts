import { HttpException, Logger } from '@nestjs/common';
import { JwtService } from '@nestjs/jwt';
import { PropertiesService } from '../properties/properties.service.js';
import { AuthService } from './auth.service.js';
import { GoogleIdTokenClient } from './clients/google-id-token.client.js';
import { JwtPayload } from './interfaces/jwt-payload.interface.js';

const SECRET = 'unit-test-jwt-secret';
const CLIENT_ID = 'client-id.apps.googleusercontent.com';
const OWNER_EMAIL = 'owner@example.com';
const CREDENTIAL = 'google-id-token';

describe('AuthService', () => {
  const jwt = new JwtService();
  const get = vi.fn();
  const verify = vi.fn();
  const service = new AuthService(
    { get } as unknown as PropertiesService,
    { verify } as unknown as GoogleIdTokenClient,
    jwt,
  );
  let properties: Record<string, string | undefined>;

  beforeEach(() => {
    properties = {
      jwt_secret: SECRET,
      google_client_id: CLIENT_ID,
      admin_google_email: OWNER_EMAIL,
    };
    get
      .mockReset()
      .mockImplementation((key: string) =>
        Promise.resolve(properties[key] ?? null),
      );
    verify
      .mockReset()
      .mockResolvedValue({ email: OWNER_EMAIL, emailVerified: true });
    vi.spyOn(Logger.prototype, 'error').mockImplementation(() => undefined);
  });

  afterEach(() => {
    vi.restoreAllMocks();
  });

  async function rejection(promise: Promise<unknown>) {
    const error = (await promise.catch((e: unknown) => e)) as HttpException;
    expect(error).toBeInstanceOf(HttpException);
    return { status: error.getStatus(), message: error.message };
  }

  it('returns a token for the owner signed with jwt_secret that expires after 1 hour', async () => {
    const result = await service.loginWithGoogle({ credential: CREDENTIAL });

    expect(verify).toHaveBeenCalledWith(CREDENTIAL, CLIENT_ID);
    expect(result.expiresIn).toBe(3600);
    const payload = await jwt.verifyAsync<
      JwtPayload & { iat: number; exp: number }
    >(result.accessToken, { secret: SECRET, algorithms: ['HS256'] });
    expect(payload.sub).toBe('owner');
    expect(payload.exp - payload.iat).toBe(3600);
  });

  it.each(['google_client_id', 'admin_google_email'])(
    'answers 500 "Sign-in is not available." when %s is missing',
    async (key) => {
      properties[key] = undefined;

      expect(
        await rejection(service.loginWithGoogle({ credential: CREDENTIAL })),
      ).toEqual({ status: 500, message: 'Sign-in is not available.' });
      expect(verify).not.toHaveBeenCalled();
    },
  );

  it('answers 401 when Google does not verify the credential', async () => {
    verify.mockResolvedValue(null);

    expect(
      await rejection(service.loginWithGoogle({ credential: CREDENTIAL })),
    ).toEqual({ status: 401, message: 'Invalid Google sign-in.' });
  });

  it('answers 403 when the email is not verified', async () => {
    verify.mockResolvedValue({ email: OWNER_EMAIL, emailVerified: false });

    expect(
      await rejection(service.loginWithGoogle({ credential: CREDENTIAL })),
    ).toEqual({
      status: 403,
      message: 'This Google account is not authorized.',
    });
  });

  it('answers 403 for another Google account', async () => {
    verify.mockResolvedValue({
      email: 'someone@example.com',
      emailVerified: true,
    });

    expect(
      await rejection(service.loginWithGoogle({ credential: CREDENTIAL })),
    ).toEqual({
      status: 403,
      message: 'This Google account is not authorized.',
    });
  });

  it('accepts the owner email with a different case or surrounding spaces', async () => {
    properties.admin_google_email = '  Owner@Example.com ';
    verify.mockResolvedValue({
      email: 'OWNER@example.COM',
      emailVerified: true,
    });

    await expect(
      service.loginWithGoogle({ credential: CREDENTIAL }),
    ).resolves.toMatchObject({ expiresIn: 3600 });
  });

  it('answers 500 "Internal server error." when jwt_secret is missing', async () => {
    properties.jwt_secret = undefined;

    expect(
      await rejection(service.loginWithGoogle({ credential: CREDENTIAL })),
    ).toEqual({ status: 500, message: 'Internal server error.' });
  });
});
