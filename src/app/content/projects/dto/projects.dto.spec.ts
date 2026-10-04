import { plainToInstance } from 'class-transformer';
import { validate } from 'class-validator';
import { ProjectDto } from './projects.dto.js';

async function errorsFor(body: Record<string, unknown>) {
  const dto = plainToInstance(ProjectDto, body);
  const errors = await validate(dto, { whitelist: true });
  return { dto, fields: errors.map((error) => error.property) };
}

const draft = { slug: 'portfolio', title: 'Portfolio' };

describe('ProjectDto', () => {
  it('accepts a draft with only slug and title', async () => {
    expect((await errorsFor(draft)).fields).toEqual([]);
  });

  it('requires slug and title', async () => {
    expect((await errorsFor({})).fields).toEqual(['slug', 'title']);
  });

  it('strips position, which projects no longer have', async () => {
    const { dto, fields } = await errorsFor({ ...draft, position: 3 });

    expect(fields).toEqual([]);
    expect(dto).not.toHaveProperty('position', 3);
  });

  it.each(['a'.repeat(101), '-a', 'a--b', 'Upper', 'a b', 'all'])(
    'refuses the slug %j',
    async (slug) => {
      expect((await errorsFor({ ...draft, slug })).fields).toEqual(['slug']);
    },
  );

  it('accepts a full project', async () => {
    const full = {
      ...draft,
      description: 'Personal site.',
      image: 'https://api.figueroa-sanchez.com/files/1',
      tags: ['Angular'],
      link: 'https://example.com',
      github: 'http://github.com/example',
      body: 'x'.repeat(100_000),
    };

    expect((await errorsFor(full)).fields).toEqual([]);
  });

  it('refuses a body over 100,000 characters and non-http links', async () => {
    const { fields } = await errorsFor({
      ...draft,
      body: 'x'.repeat(100_001),
      link: 'javascript:alert(1)',
      github: 'ftp://example.com',
    });

    expect(fields.sort()).toEqual(['body', 'github', 'link']);
  });

  it('turns empty optional texts into null', async () => {
    const { dto, fields } = await errorsFor({
      ...draft,
      description: '',
      image: '',
      link: '',
      github: '',
      body: '',
    });

    expect(fields).toEqual([]);
    expect(dto).toMatchObject({
      description: null,
      image: null,
      link: null,
      github: null,
      body: null,
    });
  });
});
