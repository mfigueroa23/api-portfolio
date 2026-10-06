import { CONTACT_INVALID_MESSAGE } from '../../contact/contact.constants.js';

// Also returned for silently discarded honeypot submissions, so bots get the
// same answer as real visitors.
export const TESTIMONIAL_SUCCESS_MESSAGE =
  'Thanks! Your testimonial will appear once it has been reviewed.';

// The same generic text as the contact form.
export const TESTIMONIAL_INVALID_MESSAGE = CONTACT_INVALID_MESSAGE;

export const TESTIMONIAL_LIMIT_MESSAGE =
  'Too many submissions. Please try again later.';
