import type { Request } from 'express';
import { SPANISH, translate } from './messages.js';
import { requestLang } from './request-lang.js';

// Table K-1 of Spec 004.
const K1: [string, string][] = [
  [
    "Message sent successfully! I'll get back to you soon.",
    '¡Mensaje enviado! Te responderé pronto.',
  ],
  [
    'Please fill in all the fields with valid values.',
    'Completa todos los campos con valores válidos.',
  ],
  [
    'Too many messages. Please try again later.',
    'Demasiados mensajes. Inténtalo más tarde.',
  ],
  [
    'The contact service is not available.',
    'El servicio de contacto no está disponible.',
  ],
  [
    'Failed to send the message. Please try again later.',
    'No se pudo enviar el mensaje. Inténtalo más tarde.',
  ],
  [
    'Thanks! Your testimonial will appear once it has been reviewed.',
    '¡Gracias! Tu testimonio aparecerá cuando haya sido revisado.',
  ],
  [
    'Too many submissions. Please try again later.',
    'Demasiados envíos. Inténtalo más tarde.',
  ],
];

describe('translate', () => {
  it('holds exactly the rows of table K-1', () => {
    const byKey = ([a]: [string, string], [b]: [string, string]) =>
      a.localeCompare(b);

    expect(Object.entries(SPANISH).sort(byKey)).toEqual([...K1].sort(byKey));
  });

  it.each(K1)('translates %j to Spanish', (english, spanish) => {
    expect(translate(english, 'es')).toBe(spanish);
    expect(translate(english, 'en')).toBe(english);
  });

  it('keeps messages outside the table unchanged', () => {
    expect(translate('Not found.', 'es')).toBe('Not found.');
  });
});

describe('requestLang', () => {
  const req = (query: Record<string, unknown>) =>
    ({ query }) as unknown as Request;

  it.each([
    [{ lang: 'es' }, 'es'],
    [{ lang: 'en' }, 'en'],
    [{ lang: 'fr' }, 'en'],
    [{ lang: ['es'] }, 'en'],
    [{}, 'en'],
  ])('reads %j as %s', (query, lang) => {
    expect(requestLang(req(query))).toBe(lang);
  });

  it('answers English when the request has no query', () => {
    expect(requestLang({} as Request)).toBe('en');
  });
});
