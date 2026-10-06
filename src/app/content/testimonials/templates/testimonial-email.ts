import {
  EmailContent,
  EmailLanguage,
  renderEmail,
  renderText,
} from '../../../mail/templates/email-layout.js';
import { TestimonialSubmission } from '../interfaces/testimonial-submission.interface.js';

export interface TestimonialEmail extends TestimonialSubmission {
  // Language of the page the visitor submitted from.
  language: EmailLanguage;
}

export const testimonialEmailSubject = ({ name }: TestimonialEmail): string =>
  `New testimonial from ${name}`;

// Always written in English (the owner's language), whatever the visitor's.
const testimonialEmail = ({
  name,
  role,
  email,
  testimonial,
  language,
}: TestimonialEmail): EmailContent => ({
  title: 'New testimonial from your portfolio',
  eyebrow: 'New Testimonial',
  heading: 'Testimonial from',
  name,
  details: [
    { label: 'Name', value: name },
    { label: 'Role', value: role },
    { label: 'Email', value: email, href: `mailto:${email}` },
  ],
  language,
  messageLabel: 'Testimonial',
  message: testimonial,
  replyTo: email,
  footer: 'Sent from the testimonial form of',
});

export const testimonialEmailText = (submission: TestimonialEmail): string =>
  renderText(testimonialEmail(submission));

export const testimonialEmailHtml = (submission: TestimonialEmail): string =>
  renderEmail(testimonialEmail(submission));
