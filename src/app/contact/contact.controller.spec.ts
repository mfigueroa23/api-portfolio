import { Test } from '@nestjs/testing';
import { CONTACT_SUCCESS_MESSAGE } from './contact.constants.js';
import { ContactController } from './contact.controller.js';
import { ContactService } from './contact.service.js';

describe('ContactController', () => {
  const send = vi.fn();
  let controller: ContactController;

  beforeEach(async () => {
    send.mockReset().mockResolvedValue(undefined);
    const moduleRef = await Test.createTestingModule({
      controllers: [ContactController],
      providers: [{ provide: ContactService, useValue: { send } }],
    }).compile();
    controller = moduleRef.get(ContactController);
  });

  it('delegates to the service and answers the success message', async () => {
    const message = { name: 'Ada', email: 'ada@example.com', message: 'Hi' };

    await expect(controller.send(message)).resolves.toEqual({
      message: CONTACT_SUCCESS_MESSAGE,
    });
    expect(send).toHaveBeenCalledWith(message, 'en');
  });

  it('propagates service errors', async () => {
    send.mockRejectedValue(new Error('boom'));

    await expect(
      controller.send({ name: 'Ada', email: 'a@b.co', message: 'Hi' }),
    ).rejects.toThrow('boom');
  });

  it("answers the spec's success text", () => {
    expect(CONTACT_SUCCESS_MESSAGE).toBe(
      "Message sent successfully! I'll get back to you soon.",
    );
  });

  it('answers in Spanish and passes the language for lang=es', async () => {
    const message = { name: 'Ada', email: 'ada@example.com', message: 'Hi' };

    await expect(controller.send(message, { lang: 'es' })).resolves.toEqual({
      message: '¡Mensaje enviado! Te responderé pronto.',
    });
    expect(send).toHaveBeenCalledWith(message, 'es');
  });

  it('answers in English without a supported language', async () => {
    const message = { name: 'Ada', email: 'ada@example.com', message: 'Hi' };

    await expect(
      controller.send(message, { lang: 'fr' as 'es' }),
    ).resolves.toEqual({ message: CONTACT_SUCCESS_MESSAGE });
    expect(send).toHaveBeenCalledWith(message, 'en');
  });
});
