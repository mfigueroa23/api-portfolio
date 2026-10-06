import type { Lang } from './lang.js';

// Text fields with an English and a Spanish (`<field>Es`) version per
// collection. Names, URLs, dates, tags, images and slugs are shared; slugEs is
// a URL, not a translation (Spec 004 RF-147, RF-148).
export const BILINGUAL_FIELDS = {
  projects: ['title', 'description', 'body'],
  posts: ['title', 'summary', 'body', 'references'],
  experiences: ['period', 'role', 'description', 'body'],
  certifications: ['name'],
  highlights: ['title', 'description'],
  contactInfo: ['label'],
  testimonials: ['quote', 'role'],
} as const;

// Post references: `titleEs` is the Spanish version of `title`.
const REFERENCES = 'references';

interface Reference {
  title?: unknown;
  titleEs?: unknown;
  url?: unknown;
}

const hasText = (value: unknown): boolean =>
  typeof value === 'string' && value.trim() !== '';

const referencesOf = (value: unknown): Reference[] =>
  Array.isArray(value) ? (value as Reference[]) : [];

const spanishKey = (field: string): string => `${field}Es`;

type SpanishKeys<F extends string> = `${F}Es`;

export type Localized<T, F extends string> = Omit<T, SpanishKeys<F>> & {
  lang: Lang;
};

// RF-149: translated when every bilingual field with an English value also has
// a Spanish one (for references: every titled reference has `titleEs`).
// Optional English fields left empty do not count.
export function isTranslated(row: object, fields: readonly string[]): boolean {
  const values = row as Record<string, unknown>;
  return fields.every((field) => {
    if (field === REFERENCES) {
      return referencesOf(values[field]).every(
        (reference) => !hasText(reference.title) || hasText(reference.titleEs),
      );
    }
    return !hasText(values[field]) || hasText(values[spanishKey(field)]);
  });
}

// All Spanish (lang "es") when Spanish is asked for and the item is
// translated, otherwise all English (lang "en"), so a page never mixes
// languages within an item (RF-150, RF-151). The `<field>Es` columns never
// leave the public API.
export function localize<T extends object, F extends string>(
  row: T,
  fields: readonly F[],
  lang: Lang,
): Localized<T, F> {
  const spanish = lang === 'es' && isTranslated(row, fields);
  const values = row as Record<string, unknown>;
  const result: Record<string, unknown> = { ...values };
  for (const field of fields) {
    if (field === REFERENCES) {
      result[field] = referencesOf(values[field]).map(
        ({ title, titleEs, url }) => ({
          title: spanish && hasText(titleEs) ? titleEs : title,
          url,
        }),
      );
      continue;
    }
    const key = spanishKey(field);
    if (spanish && hasText(values[key])) result[field] = values[key];
    delete result[key];
  }
  result.lang = spanish ? 'es' : 'en';
  return result as Localized<T, F>;
}
