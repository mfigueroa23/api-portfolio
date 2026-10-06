import { plainToInstance } from 'class-transformer';
import { validate } from 'class-validator';
import {
  CreateTestimonialDto,
  UpdateTestimonialDto,
} from './testimonials.dto.js';

const valid = {
  quote: 'Great work.',
  author: 'Grace Hopper',
  role: 'Admiral',
};

async function errorsFor(
  type: typeof CreateTestimonialDto | typeof UpdateTestimonialDto,
  body: Record<string, unknown>,
) {
  const dto = plainToInstance(type, body);
  const errors = await validate(dto, { whitelist: true });
  return { dto, fields: errors.map((error) => error.property) };
}

describe.each([
  ['CreateTestimonialDto', CreateTestimonialDto],
  ['UpdateTestimonialDto', UpdateTestimonialDto],
] as const)('%s', (_name, type) => {
  it('accepts a testimonial without a photo', async () => {
    expect((await errorsFor(type, valid)).fields).toEqual([]);
  });

  it('stores an empty photo as null', async () => {
    const { dto, fields } = await errorsFor(type, { ...valid, avatar: '' });

    expect(fields).toEqual([]);
    expect(dto.avatar).toBeNull();
  });

  it('accepts an http(s) photo URL of up to 500 characters', async () => {
    const avatar = `https://api.figueroa-sanchez.com/files/${'a'.repeat(461)}`;
    expect(avatar.length).toBe(500);

    expect((await errorsFor(type, { ...valid, avatar })).fields).toEqual([]);
    expect(
      (await errorsFor(type, { ...valid, avatar: 'http://localhost:3000/x' }))
        .fields,
    ).toEqual([]);
  });

  it.each([
    ['a relative path', '/avatars/grace.png'],
    ['a javascript: URL', 'javascript:alert(1)'],
    ['a too long URL', `https://example.com/${'a'.repeat(481)}`],
  ])('rejects %s as photo', async (_label, avatar) => {
    expect((await errorsFor(type, { ...valid, avatar })).fields).toEqual([
      'avatar',
    ]);
  });

  it('limits the quote to 500 characters', async () => {
    expect(
      (await errorsFor(type, { ...valid, quote: 'a'.repeat(500) })).fields,
    ).toEqual([]);
    expect(
      (await errorsFor(type, { ...valid, quote: 'a'.repeat(501) })).fields,
    ).toEqual(['quote']);
  });

  it('requires quote, author and role', async () => {
    expect((await errorsFor(type, {})).fields.sort()).toEqual([
      'author',
      'quote',
      'role',
    ]);
  });

  it('limits author and role to 200 characters', async () => {
    expect(
      (
        await errorsFor(type, {
          ...valid,
          author: 'a'.repeat(201),
          role: 'a'.repeat(201),
        })
      ).fields.sort(),
    ).toEqual(['author', 'role']);
  });
});

describe('CreateTestimonialDto', () => {
  it('has no position: the item is always placed first', async () => {
    const { dto } = await errorsFor(CreateTestimonialDto, {
      ...valid,
      position: 3,
    });

    expect(dto).not.toHaveProperty('position');
  });
});

describe('UpdateTestimonialDto', () => {
  it('accepts an optional non-negative position', async () => {
    expect((await errorsFor(UpdateTestimonialDto, valid)).fields).toEqual([]);
    expect(
      (await errorsFor(UpdateTestimonialDto, { ...valid, position: 2 })).fields,
    ).toEqual([]);
    expect(
      (await errorsFor(UpdateTestimonialDto, { ...valid, position: -1 }))
        .fields,
    ).toEqual(['position']);
  });
});
