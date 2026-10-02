import { Injectable, InternalServerErrorException } from '@nestjs/common';
import { PropertiesService } from '../properties/properties.service.js';
import { BrevoClient } from './clients/brevo.client.js';
import { ContactMessage } from './interfaces/contact-message.interface.js';
import {
  contactEmailHtml,
  contactEmailSubject,
  contactEmailText,
} from './templates/contact-email.js';

@Injectable()
export class ContactService {
  constructor(
    private readonly properties: PropertiesService,
    private readonly brevo: BrevoClient,
  ) {}

  async send(message: ContactMessage): Promise<void> {
    const apiKey = await this.properties.get('brevo_api_key');
    if (!apiKey) {
      throw new InternalServerErrorException(
        'The contact service is not available.',
      );
    }

    await this.brevo.sendEmail(apiKey, {
      replyTo: { name: message.name, email: message.email },
      subject: contactEmailSubject(message),
      html: contactEmailHtml(message),
      text: contactEmailText(message),
    });
  }
}
