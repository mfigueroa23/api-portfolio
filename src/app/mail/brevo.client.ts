import { BadGatewayException, Injectable, Logger } from '@nestjs/common';

const BREVO_URL = 'https://api.brevo.com/v3/smtp/email';
// One sender address for every email; the display name tells the owner which
// form the email comes from ("Portfolio Contact", "Portfolio Testimonials").
const SENDER_EMAIL = 'contact@figueroa-sanchez.com';
const OWNER = { name: 'Marco Figueroa', email: 'marco@figueroa-sanchez.com' };
const TIMEOUT_MS = 10_000;
const FAILURE_MESSAGE = 'Failed to send the message. Please try again later.';

export interface OutgoingEmail {
  senderName: string;
  replyTo: { name: string; email: string };
  subject: string;
  html: string;
  text: string;
}

// Sends from a fixed sender address to the owner, with the visitor as reply-to so the
// owner can answer straight from the mail client.
@Injectable()
export class BrevoClient {
  private readonly logger = new Logger(BrevoClient.name);

  async sendEmail(apiKey: string, email: OutgoingEmail): Promise<void> {
    let response: Response;
    try {
      response = await fetch(BREVO_URL, {
        method: 'POST',
        headers: {
          'api-key': apiKey,
          'content-type': 'application/json',
          accept: 'application/json',
        },
        body: JSON.stringify({
          sender: { name: email.senderName, email: SENDER_EMAIL },
          to: [OWNER],
          replyTo: email.replyTo,
          subject: email.subject,
          htmlContent: email.html,
          textContent: email.text,
        }),
        signal: AbortSignal.timeout(TIMEOUT_MS),
      });
    } catch {
      // The error may echo request details, so only a fixed text is logged.
      this.logger.error('Brevo request failed: provider unreachable');
      throw new BadGatewayException(FAILURE_MESSAGE);
    }

    // The body is discarded unread: provider error bodies never reach logs or
    // clients.
    await response.body?.cancel();
    if (!response.ok) {
      this.logger.error(
        `Brevo rejected the email with status ${response.status}`,
      );
      throw new BadGatewayException(FAILURE_MESSAGE);
    }
  }
}
