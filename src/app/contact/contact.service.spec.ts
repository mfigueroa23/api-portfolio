import { BadGatewayException, HttpException } from '@nestjs/common';
import { MailService, MailUnavailableError } from '../mail/mail.service.js';
import { ContactService } from './contact.service.js';
import {
  contactEmailHtml,
  contactEmailSubject,
  contactEmailText,
} from './templates/contact-email.js';

const visitor = {
  name: 'Ada',
  email: 'ada@example.com',
  message: 'Hello <b>there</b>',
};

describe('ContactService', () => {
  const send = vi.fn();
  const service = new ContactService({ send } as unknown as MailService);

  beforeEach(() => {
    send.mockReset().mockResolvedValue(undefined);
  });

  it('sends the templated email once as "Portfolio Contact"', async () => {
    await service.send(visitor);

    expect(send).toHaveBeenCalledTimes(1);
    expect(send).toHaveBeenCalledWith({
      senderName: 'Portfolio Contact',
      replyTo: { name: 'Ada', email: 'ada@example.com' },
      subject: contactEmailSubject(visitor),
      html: contactEmailHtml(visitor),
      text: contactEmailText(visitor),
    });
  });

  it('answers 500 when the mail service is not configured', async () => {
    send.mockRejectedValue(new MailUnavailableError());

    const error = await service.send(visitor).catch((e: unknown) => e);

    expect(error).toBeInstanceOf(HttpException);
    expect((error as HttpException).getStatus()).toBe(500);
    expect((error as HttpException).message).toBe(
      'The contact service is not available.',
    );
  });

  it('propagates provider failures (502)', async () => {
    send.mockRejectedValue(new BadGatewayException('down'));

    await expect(service.send(visitor)).rejects.toBeInstanceOf(
      BadGatewayException,
    );
  });

  it('writes the visitor language in the email', async () => {
    await service.send(visitor, 'es');

    expect(send).toHaveBeenCalledWith(
      expect.objectContaining({
        html: contactEmailHtml(visitor, 'es'),
        text: contactEmailText(visitor, 'es'),
      }),
    );
  });
});
