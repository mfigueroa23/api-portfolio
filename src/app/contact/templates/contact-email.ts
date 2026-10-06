import {
  EmailContent,
  EmailLanguage,
  renderEmail,
  renderText,
} from '../../mail/templates/email-layout.js';
import { ContactMessage } from '../interfaces/contact-message.interface.js';

export const contactEmailSubject = ({ name }: ContactMessage): string =>
  `New portfolio message from ${name}`;

// Always written in English (the owner's language); `language` is the page
// the visitor wrote from.
const contactEmail = (
  { name, email, message }: ContactMessage,
  language: EmailLanguage,
): EmailContent => ({
  title: 'New message from your portfolio',
  eyebrow: 'Get In Touch',
  heading: 'New message from',
  name,
  details: [
    { label: 'Name', value: name },
    { label: 'Email', value: email, href: `mailto:${email}` },
  ],
  language,
  messageLabel: 'Message',
  message,
  replyTo: email,
  footer: 'Sent from the contact form of',
});

export const contactEmailText = (
  message: ContactMessage,
  language: EmailLanguage = 'en',
): string => renderText(contactEmail(message, language));

export const contactEmailHtml = (
  message: ContactMessage,
  language: EmailLanguage = 'en',
): string => renderEmail(contactEmail(message, language));
