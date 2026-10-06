import { BILINGUAL_FIELDS, isTranslated, localize } from './translation.js';

const project = {
  id: 1,
  slug: 'portfolio',
  slugEs: 'portafolio',
  title: 'Portfolio',
  titleEs: 'Portafolio',
  description: 'My site.',
  descriptionEs: 'Mi sitio.',
  body: '## Hi',
  bodyEs: '## Hola',
  tags: ['Angular'],
};

describe('BILINGUAL_FIELDS', () => {
  it('lists the translatable fields of every collection', () => {
    expect(BILINGUAL_FIELDS).toEqual({
      projects: ['title', 'description', 'body'],
      posts: ['title', 'summary', 'body', 'references'],
      experiences: ['period', 'role', 'description', 'body'],
      certifications: ['name'],
      highlights: ['title', 'description'],
      contactInfo: ['label'],
      testimonials: ['quote', 'role'],
    });
  });
});

describe('isTranslated', () => {
  const fields = BILINGUAL_FIELDS.projects;

  it('is true when every field with an English value has a Spanish one', () => {
    expect(isTranslated(project, fields)).toBe(true);
  });

  it('is false when any of them lacks its Spanish value', () => {
    expect(isTranslated({ ...project, bodyEs: null }, fields)).toBe(false);
    expect(isTranslated({ ...project, bodyEs: '   ' }, fields)).toBe(false);
  });

  it('ignores optional English fields that are empty', () => {
    expect(
      isTranslated(
        { ...project, description: null, descriptionEs: null },
        fields,
      ),
    ).toBe(true);
    expect(isTranslated({ ...project, body: '', bodyEs: null }, fields)).toBe(
      true,
    );
  });

  it('treats content from before Spec 004 (no Spanish) as not translated', () => {
    expect(
      isTranslated(
        { ...project, titleEs: null, descriptionEs: null, bodyEs: null },
        fields,
      ),
    ).toBe(false);
  });

  it('requires a Spanish title on every reference', () => {
    const post = {
      title: 'T',
      titleEs: 'T es',
      references: [
        { title: 'Docs', titleEs: 'Documentación', url: 'https://a.test' },
        { title: 'Spec', url: 'https://b.test' },
      ],
    };
    const fields = ['title', 'references'] as const;

    expect(isTranslated(post, fields)).toBe(false);
    expect(
      isTranslated(
        {
          ...post,
          references: [{ title: 'Docs', titleEs: 'Docs', url: 'https://a' }],
        },
        fields,
      ),
    ).toBe(true);
    expect(isTranslated({ ...post, references: [] }, fields)).toBe(true);
  });
});

describe('localize', () => {
  const fields = BILINGUAL_FIELDS.projects;

  it('returns the Spanish values with lang "es" for a translated item', () => {
    expect(localize(project, fields, 'es')).toEqual({
      id: 1,
      slug: 'portfolio',
      slugEs: 'portafolio',
      title: 'Portafolio',
      description: 'Mi sitio.',
      body: '## Hola',
      tags: ['Angular'],
      lang: 'es',
    });
  });

  it('returns every English value with lang "en" when not fully translated', () => {
    expect(localize({ ...project, bodyEs: null }, fields, 'es')).toEqual({
      id: 1,
      slug: 'portfolio',
      slugEs: 'portafolio',
      title: 'Portfolio',
      description: 'My site.',
      body: '## Hi',
      tags: ['Angular'],
      lang: 'en',
    });
  });

  it('returns English for English requests even when translated', () => {
    expect(localize(project, fields, 'en')).toMatchObject({
      title: 'Portfolio',
      lang: 'en',
    });
  });

  it('strips every *Es field of the collection but keeps slugEs', () => {
    const localized = localize(project, fields, 'en');

    expect(Object.keys(localized)).not.toEqual(
      expect.arrayContaining(['titleEs', 'descriptionEs', 'bodyEs']),
    );
    expect(localized).toHaveProperty('slugEs', 'portafolio');
  });

  it('localizes reference titles and strips titleEs', () => {
    const post = {
      title: 'T',
      titleEs: 'T es',
      references: [{ title: 'Docs', titleEs: 'Documentos', url: 'https://a' }],
    };
    const fields = ['title', 'references'] as const;

    expect(localize(post, fields, 'es')).toEqual({
      title: 'T es',
      references: [{ title: 'Documentos', url: 'https://a' }],
      lang: 'es',
    });
    expect(localize(post, fields, 'en')).toEqual({
      title: 'T',
      references: [{ title: 'Docs', url: 'https://a' }],
      lang: 'en',
    });
  });
});
