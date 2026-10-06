import { Injectable, InternalServerErrorException } from '@nestjs/common';
import { MailService, MailUnavailableError } from '../mail/mail.service.js';
import { EmailLanguage } from '../mail/templates/email-layout.js';
import { ContactMessage } from './interfaces/contact-message.interface.js';
import {
  contactEmailHtml,
  contactEmailSubject,
  contactEmailText,
} from './templates/contact-email.js';

@Injectable()
export class ContactService {
  constructor(private readonly mail: MailService) {}

  // Provider failures (502) propagate as they are; a missing credential is a
  // server-side misconfiguration, answered with 500.
  async send(
    message: ContactMessage,
    language: EmailLanguage = 'en',
  ): Promise<void> {
    try {
      await this.mail.send({
        senderName: 'Portfolio Contact',
        replyTo: { name: message.name, email: message.email },
        subject: contactEmailSubject(message),
        html: contactEmailHtml(message, language),
        text: contactEmailText(message, language),
      });
    } catch (error) {
      if (error instanceof MailUnavailableError) {
        throw new InternalServerErrorException(
          'The contact service is not available.',
        );
      }
      throw error;
    }
  }
}
