import { ConflictException } from '@nestjs/common';
import { PrismaFake } from '../../../../test/fakes/prisma.fake.js';
import {
  assertSlugFree,
  isValidSlug,
  RESERVED_POST_SLUGS,
  SLUG_CONFLICT,
  SLUG_MAX_LENGTH,
  SlugLookup,
} from './slug.js';

describe('slug rules', () => {
  it.each(['a', '7', 'a'.repeat(100), 'my-post-2', 'a-b-c'])(
    'accepts %s',
    (slug) => {
      expect(isValidSlug(slug)).toBe(true);
    },
  );

  it.each([
    '',
    'a'.repeat(101),
    '-a',
    'a-',
    'a--b',
    'Upper',
    'with space',
    'año',
    'a_b',
  ])('refuses %j', (slug) => {
    expect(isValidSlug(slug)).toBe(false);
  });

  it('limits slugs to 100 characters and reserves tag and page for posts', () => {
    expect(SLUG_MAX_LENGTH).toBe(100);
    expect(RESERVED_POST_SLUGS).toEqual(['tag', 'page']);
  });
});

describe('assertSlugFree', () => {
  let prisma: PrismaFake;
  const posts = () => prisma.post as unknown as SlugLookup;

  beforeEach(async () => {
    prisma = new PrismaFake();
    await prisma.post.create({ data: { slug: 'taken', title: 'A' } });
  });

  it('passes for an unused slug', async () => {
    await expect(assertSlugFree(posts(), 'free')).resolves.toBeUndefined();
  });

  it('passes when the slug belongs to the item being updated', async () => {
    await expect(assertSlugFree(posts(), 'taken', 1)).resolves.toBeUndefined();
  });

  it('answers 409 with a slug field error when another item uses it', async () => {
    const error = await assertSlugFree(posts(), 'taken', 2).catch(
      (caught: unknown) => caught,
    );

    expect(error).toBeInstanceOf(ConflictException);
    expect((error as ConflictException).getResponse()).toEqual({
      error: 'This slug is already in use.',
      fields: { slug: ['This slug is already in use.'] },
    });
    expect(SLUG_CONFLICT).toBe('This slug is already in use.');
  });
});
