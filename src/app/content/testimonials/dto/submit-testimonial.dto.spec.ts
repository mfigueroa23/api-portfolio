import { plainToInstance } from 'class-transformer';
import { validate } from 'class-validator';
import { SubmitTestimonialDto } from './submit-testimonial.dto.js';

const valid = {
  name: 'Ada Lovelace',
  role: 'Engineer at Acme',
  email: 'ada@example.com',
  testimonial: 'Great to work with.',
};

async function errorsFor(body: Record<string, unknown>) {
  const dto = plainToInstance(SubmitTestimonialDto, body);
  const errors = await validate(dto, { whitelist: true });
  return { dto, fields: errors.map((error) => error.property) };
}

describe('SubmitTestimonialDto', () => {
  it('accepts a valid submission', async () => {
    expect((await errorsFor(valid)).fields).toEqual([]);
  });

  it('trims every field before validating', async () => {
    const { dto, fields } = await errorsFor({
      name: '  Ada  ',
      role: '\tEngineer ',
      email: ' ada@example.com\n',
      testimonial: '  Great.\n',
    });

    expect(fields).toEqual([]);
    expect(dto).toMatchObject({
      name: 'Ada',
      role: 'Engineer',
      email: 'ada@example.com',
      testimonial: 'Great.',
    });
  });

  it.each([
    ['name', 'a'.repeat(100)],
    ['role', 'a'.repeat(100)],
    ['email', `${'a'.repeat(188)}@example.com`],
    ['testimonial', 'a'.repeat(500)],
  ])('accepts %s at its maximum length', async (field, value) => {
    expect((await errorsFor({ ...valid, [field]: value })).fields).toEqual([]);
  });

  it.each([
    ['name', 'a'.repeat(101)],
    ['role', 'a'.repeat(101)],
    ['email', `${'a'.repeat(189)}@example.com`],
    ['testimonial', 'a'.repeat(501)],
  ])('rejects %s over its maximum length', async (field, value) => {
    expect((await errorsFor({ ...valid, [field]: value })).fields).toEqual([
      field,
    ]);
  });

  it('counts the length after trimming', async () => {
    expect(
      (await errorsFor({ ...valid, testimonial: ` ${'a'.repeat(500)} ` }))
        .fields,
    ).toEqual([]);
  });

  it.each(['name', 'role'])('rejects a line break inside %s', async (field) => {
    for (const value of ['Ada\nLovelace', 'Ada\rLovelace']) {
      expect((await errorsFor({ ...valid, [field]: value })).fields).toEqual([
        field,
      ]);
    }
  });

  it.each(['name', 'role'])(
    'rejects %s made only of emoji or invisible characters',
    async (field) => {
      for (const value of ['😀🎉', '​​', '---', '‍']) {
        expect((await errorsFor({ ...valid, [field]: value })).fields).toEqual([
          field,
        ]);
      }
    },
  );

  it('accepts names with accents, non-Latin letters or digits', async () => {
    for (const name of ['Álvaro Núñez', '李小龍', 'R2 😀']) {
      expect((await errorsFor({ ...valid, name })).fields).toEqual([]);
    }
  });

  it('keeps line breaks inside the testimonial', async () => {
    const { dto, fields } = await errorsFor({
      ...valid,
      testimonial: 'First line\nsecond line',
    });

    expect(fields).toEqual([]);
    expect(dto.testimonial).toBe('First line\nsecond line');
  });

  it.each(['name', 'role', 'email', 'testimonial'])(
    'rejects %s when missing, empty, whitespace only or not text',
    async (field) => {
      for (const value of [undefined, '', '   ', 7]) {
        expect((await errorsFor({ ...valid, [field]: value })).fields).toEqual([
          field,
        ]);
      }
    },
  );

  it('rejects an invalid email', async () => {
    for (const email of ['ada@example', 'ada example.com', 'a@b@c.d']) {
      expect((await errorsFor({ ...valid, email })).fields).toEqual(['email']);
    }
  });

  it('keeps the honeypot field through whitelisting', async () => {
    const { dto } = await errorsFor({ ...valid, website: '' });

    expect(dto.website).toBe('');
  });
});
