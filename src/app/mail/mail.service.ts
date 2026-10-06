import { Injectable } from '@nestjs/common';
import { PropertiesService } from '../properties/properties.service.js';
import { BrevoClient, OutgoingEmail } from './brevo.client.js';

// Thrown when the provider credential is not configured. Callers decide what
// it means for them: the contact form answers 500, while a testimonial is kept
// and only marked as not notified.
export class MailUnavailableError extends Error {
  constructor() {
    super('The mail service is not configured.');
    this.name = 'MailUnavailableError';
  }
}

@Injectable()
export class MailService {
  constructor(
    private readonly properties: PropertiesService,
    private readonly brevo: BrevoClient,
  ) {}

  // The key is read on every send so a rotated key applies without a restart.
  async send(email: OutgoingEmail): Promise<void> {
    const apiKey = await this.properties.get('brevo_api_key');
    if (!apiKey) throw new MailUnavailableError();
    await this.brevo.sendEmail(apiKey, email);
  }
}
