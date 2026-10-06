import { ConflictException } from '@nestjs/common';
import { PrismaFake } from '../../../../test/fakes/prisma.fake.js';
import {
  assertSlugFree,
  assertUrlSlugFree,
  isValidSlug,
  RESERVED_POST_SLUGS,
  RESERVED_PROJECT_SLUGS,
  SLUG_CONFLICT,
  SLUG_MAX_LENGTH,
  SlugLookup,
  UrlSlugLookup,
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

  it('limits slugs to 100 characters and reserves the listing routes', () => {
    expect(SLUG_MAX_LENGTH).toBe(100);
    expect(RESERVED_POST_SLUGS).toEqual(['tag', 'page', 'all', 'feed']);
    expect(RESERVED_PROJECT_SLUGS).toEqual(['all']);
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

describe('assertUrlSlugFree', () => {
  let prisma: PrismaFake;

  beforeEach(async () => {
    prisma = new PrismaFake();
    // id 1: no Spanish slug (Spanish URL slug "hello");
    // id 2: Spanish slug "hola" (Spanish URL slug "hola").
    await prisma.post.create({ data: { slug: 'hello', title: 'A' } });
    await prisma.post.create({
      data: { slug: 'world', slugEs: 'hola', title: 'B' },
    });
  });

  const check = (item: { slug: string; slugEs?: string | null }, id?: number) =>
    assertUrlSlugFree(prisma.post as unknown as UrlSlugLookup, item, id);

  it.each([
    ['a free Spanish slug', { slug: 'new', slugEs: 'nuevo' }],
    ['a free English slug and no Spanish slug', { slug: 'new' }],
  ])('accepts %s', async (_label, item) => {
    await expect(check(item)).resolves.toBeUndefined();
  });

  it.each([
    [
      'equal to another item slug without Spanish slug',
      { slug: 'x', slugEs: 'hello' },
    ],
    ['equal to another item Spanish slug', { slug: 'x', slugEs: 'hola' }],
    [
      'missing, with the English slug equal to another Spanish slug',
      { slug: 'hola' },
    ],
  ])('answers 409 on slugEs for a Spanish slug %s', async (_label, item) => {
    const error = await check(item).catch((e: unknown) => e);

    expect(error).toBeInstanceOf(ConflictException);
    expect((error as ConflictException).getResponse()).toEqual({
      error: SLUG_CONFLICT,
      fields: { slugEs: [SLUG_CONFLICT] },
    });
  });

  it('allows the item to keep its own Spanish URL slug', async () => {
    await expect(
      check({ slug: 'hello', slugEs: 'hello' }, 1),
    ).resolves.toBeUndefined();
    await expect(
      check({ slug: 'world', slugEs: 'hola' }, 2),
    ).resolves.toBeUndefined();
    await expect(check({ slug: 'world' }, 2)).resolves.toBeUndefined();
  });
});
