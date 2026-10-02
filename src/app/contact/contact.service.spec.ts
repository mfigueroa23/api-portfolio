import { HttpException } from '@nestjs/common';
import { PropertiesService } from '../properties/properties.service.js';
import { BrevoClient } from './clients/brevo.client.js';
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
  const get = vi.fn();
  const sendEmail = vi.fn();
  const service = new ContactService(
    { get } as unknown as PropertiesService,
    { sendEmail } as unknown as BrevoClient,
  );

  beforeEach(() => {
    get.mockReset();
    sendEmail.mockReset().mockResolvedValue(undefined);
  });

  it('sends the templated email once with the stored Brevo key', async () => {
    get.mockResolvedValue('stored-key');

    await service.send(visitor);

    expect(get).toHaveBeenCalledWith('brevo_api_key');
    expect(sendEmail).toHaveBeenCalledTimes(1);
    expect(sendEmail).toHaveBeenCalledWith('stored-key', {
      replyTo: { name: 'Ada', email: 'ada@example.com' },
      subject: contactEmailSubject(visitor),
      html: contactEmailHtml(visitor),
      text: contactEmailText(visitor),
    });
  });

  it('answers 500 and sends nothing when the key is not configured', async () => {
    get.mockResolvedValue(null);

    const error = await service.send(visitor).catch((e) => e);

    expect(error).toBeInstanceOf(HttpException);
    expect((error as HttpException).getStatus()).toBe(500);
    expect((error as HttpException).message).toBe(
      'The contact service is not available.',
    );
    expect(sendEmail).not.toHaveBeenCalled();
  });
});
