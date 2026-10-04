import { Logger } from '@nestjs/common';
import { GoogleIdTokenClient } from './google-id-token.client.js';

const { verifyIdToken } = vi.hoisted(() => ({ verifyIdToken: vi.fn() }));

vi.mock('google-auth-library', () => ({
  OAuth2Client: class {
    verifyIdToken = verifyIdToken;
  },
}));

const ID_TOKEN = 'google-id-token-under-test';
const CLIENT_ID = 'client-id.apps.googleusercontent.com';

function ticket(payload: object | undefined) {
  return { getPayload: () => payload };
}

describe('GoogleIdTokenClient', () => {
  const client = new GoogleIdTokenClient();
  let logSpies: ReturnType<typeof vi.spyOn>[];

  beforeEach(() => {
    verifyIdToken.mockReset();
    logSpies = [
      ...(['log', 'error', 'warn', 'debug', 'verbose'] as const).map((level) =>
        vi.spyOn(Logger.prototype, level).mockImplementation(() => undefined),
      ),
      ...(['log', 'error', 'warn', 'info', 'debug'] as const).map((level) =>
        vi.spyOn(console, level).mockImplementation(() => undefined),
      ),
    ];
  });

  afterEach(() => {
    vi.restoreAllMocks();
  });

  function expectTokenNeverLogged() {
    for (const spy of logSpies) {
      expect(JSON.stringify(spy.mock.calls)).not.toContain(ID_TOKEN);
    }
  }

  it('returns the identity of a valid ticket, checked against the client id', async () => {
    verifyIdToken.mockResolvedValue(
      ticket({ email: 'owner@example.com', email_verified: true }),
    );

    await expect(client.verify(ID_TOKEN, CLIENT_ID)).resolves.toEqual({
      email: 'owner@example.com',
      emailVerified: true,
    });
    expect(verifyIdToken).toHaveBeenCalledWith({
      idToken: ID_TOKEN,
      audience: CLIENT_ID,
    });
    expectTokenNeverLogged();
  });

  it('reports an email without email_verified as unverified', async () => {
    verifyIdToken.mockResolvedValue(ticket({ email: 'owner@example.com' }));

    await expect(client.verify(ID_TOKEN, CLIENT_ID)).resolves.toEqual({
      email: 'owner@example.com',
      emailVerified: false,
    });
  });

  it.each([
    ['bad signature', new Error('Invalid token signature')],
    ['expired token', new Error('Token used too late')],
    [
      'wrong audience',
      new Error('Wrong recipient, payload audience != requiredAudience'),
    ],
  ])('returns null when verification throws (%s)', async (_label, error) => {
    verifyIdToken.mockRejectedValue(error);

    await expect(client.verify(ID_TOKEN, CLIENT_ID)).resolves.toBeNull();
    expectTokenNeverLogged();
  });

  it.each([
    ['no payload', undefined],
    ['no email', { email_verified: true }],
    ['empty email', { email: '', email_verified: true }],
  ])('returns null for a ticket with %s', async (_label, payload) => {
    verifyIdToken.mockResolvedValue(ticket(payload));

    await expect(client.verify(ID_TOKEN, CLIENT_ID)).resolves.toBeNull();
    expectTokenNeverLogged();
  });
});
