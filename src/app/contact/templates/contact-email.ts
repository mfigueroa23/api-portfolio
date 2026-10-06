import {
  EmailContent,
  renderEmail,
  renderText,
} from '../../mail/templates/email-layout.js';
import { ContactMessage } from '../interfaces/contact-message.interface.js';

export const contactEmailSubject = ({ name }: ContactMessage): string =>
  `New portfolio message from ${name}`;

// The contact form is English-only until Spec 004 phase 3 adds `?lang`.
const contactEmail = ({
  name,
  email,
  message,
}: ContactMessage): EmailContent => ({
  title: 'New message from your portfolio',
  eyebrow: 'Get In Touch',
  heading: 'New message from',
  name,
  details: [
    { label: 'Name', value: name },
    { label: 'Email', value: email, href: `mailto:${email}` },
  ],
  language: 'en',
  messageLabel: 'Message',
  message,
  replyTo: email,
  footer: 'Sent from the contact form of',
});

export const contactEmailText = (message: ContactMessage): string =>
  renderText(contactEmail(message));

export const contactEmailHtml = (message: ContactMessage): string =>
  renderEmail(contactEmail(message));
