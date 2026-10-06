import { BadGatewayException } from '@nestjs/common';
import { PropertiesService } from '../properties/properties.service.js';
import { BrevoClient, OutgoingEmail } from './brevo.client.js';
import { MailService, MailUnavailableError } from './mail.service.js';

const email: OutgoingEmail = {
  senderName: 'Portfolio Contact',
  replyTo: { name: 'Ada', email: 'ada@example.com' },
  subject: 'Subject',
  html: '<p>Hi</p>',
  text: 'Hi',
};

describe('MailService', () => {
  const get = vi.fn();
  const sendEmail = vi.fn();
  const service = new MailService(
    { get } as unknown as PropertiesService,
    { sendEmail } as unknown as BrevoClient,
  );

  beforeEach(() => {
    get.mockReset();
    sendEmail.mockReset().mockResolvedValue(undefined);
  });

  it('sends the email once with the stored Brevo key', async () => {
    get.mockResolvedValue('stored-key');

    await service.send(email);

    expect(get).toHaveBeenCalledWith('brevo_api_key');
    expect(sendEmail).toHaveBeenCalledTimes(1);
    expect(sendEmail).toHaveBeenCalledWith('stored-key', email);
  });

  it('throws MailUnavailableError and sends nothing when the key is missing', async () => {
    get.mockResolvedValue(null);

    const error = await service.send(email).catch((e: unknown) => e);

    expect(error).toBeInstanceOf(MailUnavailableError);
    expect(sendEmail).not.toHaveBeenCalled();
  });

  it('propagates provider failures', async () => {
    get.mockResolvedValue('stored-key');
    sendEmail.mockRejectedValue(new BadGatewayException('down'));

    await expect(service.send(email)).rejects.toBeInstanceOf(
      BadGatewayException,
    );
  });
});
