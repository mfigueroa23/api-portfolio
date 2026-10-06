import type { Lang } from '../../content/common/lang.js';

// Table K-1 of Spec 004: the Spanish text of every message the public forms
// return. The owner's emails and every other API message stay in English.
export const SPANISH: Readonly<Record<string, string>> = {
  "Message sent successfully! I'll get back to you soon.":
    '¡Mensaje enviado! Te responderé pronto.',
  'Please fill in all the fields with valid values.':
    'Completa todos los campos con valores válidos.',
  'Too many messages. Please try again later.':
    'Demasiados mensajes. Inténtalo más tarde.',
  'The contact service is not available.':
    'El servicio de contacto no está disponible.',
  'Failed to send the message. Please try again later.':
    'No se pudo enviar el mensaje. Inténtalo más tarde.',
  'Thanks! Your testimonial will appear once it has been reviewed.':
    '¡Gracias! Tu testimonio aparecerá cuando haya sido revisado.',
  'Too many submissions. Please try again later.':
    'Demasiados envíos. Inténtalo más tarde.',
};

// Messages outside the table are returned unchanged.
export function translate(message: string, lang: Lang): string {
  return lang === 'es'
    ? Object.hasOwn(SPANISH, message)
      ? SPANISH[message]
      : message
    : message;
}
