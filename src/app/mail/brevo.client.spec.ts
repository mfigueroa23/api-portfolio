import { BadGatewayException, Logger } from '@nestjs/common';
import { BrevoClient, OutgoingEmail } from './brevo.client.js';

const API_KEY = 'xkeysib-secret-test-key';
const email: OutgoingEmail = {
  senderName: 'Portfolio Contact',
  replyTo: { name: 'Ada', email: 'ada@example.com' },
  subject: 'New portfolio message from Ada',
  html: '<p>Hi</p>',
  text: 'Hi',
};

describe('BrevoClient', () => {
  const client = new BrevoClient();
  let fetchMock: ReturnType<typeof vi.fn>;
  let logError: ReturnType<typeof vi.spyOn>;

  beforeEach(() => {
    fetchMock = vi.fn();
    vi.stubGlobal('fetch', fetchMock);
    logError = vi
      .spyOn(Logger.prototype, 'error')
      .mockImplementation(() => undefined);
  });

  afterEach(() => {
    vi.unstubAllGlobals();
    vi.restoreAllMocks();
  });

  it('posts the email with the fixed sender and recipient and the visitor as reply-to', async () => {
    fetchMock.mockResolvedValue(new Response('{}', { status: 201 }));

    await client.sendEmail(API_KEY, email);

    expect(fetchMock).toHaveBeenCalledTimes(1);
    const [url, init] = fetchMock.mock.calls[0] as [string, RequestInit];
    expect(url).toBe('https://api.brevo.com/v3/smtp/email');
    expect(init.method).toBe('POST');
    expect(init.headers).toMatchObject({
      'api-key': API_KEY,
      'content-type': 'application/json',
    });
    expect(JSON.parse(init.body as string)).toEqual({
      sender: {
        name: 'Portfolio Contact',
        email: 'contact@figueroa-sanchez.com',
      },
      to: [{ name: 'Marco Figueroa', email: 'marco@figueroa-sanchez.com' }],
      replyTo: { name: 'Ada', email: 'ada@example.com' },
      subject: email.subject,
      htmlContent: email.html,
      textContent: email.text,
    });
  });

  it('uses the sender name of each email with the same sender address', async () => {
    fetchMock.mockResolvedValue(new Response('{}', { status: 201 }));

    await client.sendEmail(API_KEY, {
      ...email,
      senderName: 'Portfolio Testimonials',
    });

    const [, init] = fetchMock.mock.calls[0] as [string, RequestInit];
    expect(JSON.parse(init.body as string)).toMatchObject({
      sender: {
        name: 'Portfolio Testimonials',
        email: 'contact@figueroa-sanchez.com',
      },
    });
  });

  it('throws 502 and logs only the status when Brevo rejects the request', async () => {
    fetchMock.mockResolvedValue(
      new Response('{"message":"provider body detail"}', { status: 500 }),
    );

    const error = await client.sendEmail(API_KEY, email).catch((e) => e);

    expect(error).toBeInstanceOf(BadGatewayException);
    expect((error as BadGatewayException).message).toBe(
      'Failed to send the message. Please try again later.',
    );
    const logged = JSON.stringify(logError.mock.calls);
    expect(logged).toContain('500');
    expect(logged).not.toContain(API_KEY);
    expect(logged).not.toContain('provider body detail');
  });

  it('throws 502 when Brevo is unreachable without logging the key', async () => {
    fetchMock.mockRejectedValue(new TypeError(`fetch failed ${API_KEY}`));

    const error = await client.sendEmail(API_KEY, email).catch((e) => e);

    expect(error).toBeInstanceOf(BadGatewayException);
    expect(logError).toHaveBeenCalled();
    expect(JSON.stringify(logError.mock.calls)).not.toContain(API_KEY);
  });
});
