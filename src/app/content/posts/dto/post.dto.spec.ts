import { plainToInstance } from 'class-transformer';
import { validate, ValidationError } from 'class-validator';
import { PostDto } from './post.dto.js';

// Dotted paths for nested errors, like the global ValidationPipe.
function paths(errors: ValidationError[], parent = ''): string[] {
  return errors.flatMap((error) => {
    const path = parent ? `${parent}.${error.property}` : error.property;
    return [
      ...(error.constraints ? [path] : []),
      ...paths(error.children ?? [], path),
    ];
  });
}

async function errorsFor(body: Record<string, unknown>) {
  const dto = plainToInstance(PostDto, body);
  return { dto, fields: paths(await validate(dto, { whitelist: true })) };
}

const draft = { title: 'Hello', slug: 'hello' };
const reference = { title: 'Spec', url: 'https://example.com/spec' };

describe('PostDto', () => {
  it('accepts a draft with only title and slug', async () => {
    expect((await errorsFor(draft)).fields).toEqual([]);
  });

  it('requires title and slug', async () => {
    expect((await errorsFor({})).fields).toEqual(['title', 'slug']);
  });

  it('accepts a complete post at every limit', async () => {
    const { fields } = await errorsFor({
      title: 'a'.repeat(200),
      slug: 'a'.repeat(100),
      summary: 'a'.repeat(300),
      coverUrl: 'https://api.figueroa-sanchez.com/files/1',
      tags: [
        'Angular',
        'Nextjs',
        'año 2026',
        'a-b',
        'x'.repeat(30),
        '6',
        '7',
        '8',
        '9',
        '10',
      ],
      body: 'a'.repeat(100_000),
      references: Array.from({ length: 30 }, () => ({
        title: 'a'.repeat(200),
        url: `https://example.com/${'a'.repeat(480)}`,
      })),
    });

    expect(fields).toEqual([]);
  });

  it.each(['tag', 'page', 'Bad', 'a--b', '-a', 'a'.repeat(101)])(
    'refuses the slug %j',
    async (slug) => {
      expect((await errorsFor({ ...draft, slug })).fields).toEqual(['slug']);
    },
  );

  it('refuses texts over their limits', async () => {
    const { fields } = await errorsFor({
      title: 'a'.repeat(201),
      slug: 'hello',
      summary: 'a'.repeat(301),
      body: 'a'.repeat(100_001),
    });

    expect(fields).toEqual(['title', 'summary', 'body']);
  });

  it('refuses more than 10 tags and invalid tags', async () => {
    expect(
      (
        await errorsFor({
          ...draft,
          tags: Array.from({ length: 11 }, (_, i) => `t${i}`),
        })
      ).fields,
    ).toEqual(['tags']);
    for (const tag of ['', 'x'.repeat(31), 'c#', 'a/b', 'emoji 🚀']) {
      expect((await errorsFor({ ...draft, tags: [tag] })).fields).toEqual([
        'tags',
      ]);
    }
  });

  it('refuses more than 30 references and invalid ones', async () => {
    expect(
      (
        await errorsFor({
          ...draft,
          references: Array.from({ length: 31 }, () => reference),
        })
      ).fields,
    ).toEqual(['references']);

    const { fields } = await errorsFor({
      ...draft,
      references: [
        reference,
        { title: '', url: 'javascript:alert(1)' },
        {
          title: 'a'.repeat(201),
          url: `https://example.com/${'a'.repeat(481)}`,
        },
      ],
    });

    expect(fields).toEqual([
      'references.1.title',
      'references.1.url',
      'references.2.title',
      'references.2.url',
    ]);
  });

  it('refuses a non-http cover URL', async () => {
    expect(
      (await errorsFor({ ...draft, coverUrl: 'javascript:alert(1)' })).fields,
    ).toEqual(['coverUrl']);
  });

  it('turns empty optional texts into null', async () => {
    const { dto, fields } = await errorsFor({
      ...draft,
      summary: '',
      coverUrl: '',
      body: '',
    });

    expect(fields).toEqual([]);
    expect(dto).toMatchObject({ summary: null, coverUrl: null, body: null });
  });
});
