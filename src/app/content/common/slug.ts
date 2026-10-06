import { ConflictException } from '@nestjs/common';

// Lowercase letters and digits in groups joined by single hyphens.
export const SLUG_PATTERN = /^[a-z0-9]+(?:-[a-z0-9]+)*$/;
export const SLUG_MAX_LENGTH = 100;
export const SLUG_FORMAT_MESSAGE =
  'slug must contain only lowercase letters, digits and single hyphens, without a hyphen at either end';
export const SLUG_ES_FORMAT_MESSAGE = SLUG_FORMAT_MESSAGE.replace(
  /^slug/,
  'slugEs',
);
// /blog/tag/… and /blog/page/… are listing routes on the web, and
// /content/posts/{all,feed} and /content/projects/all are API routes declared
// before /:slug, so an item with one of these slugs could never be read.
export const RESERVED_POST_SLUGS = ['tag', 'page', 'all', 'feed'];
export const RESERVED_PROJECT_SLUGS = ['all'];
export const SLUG_CONFLICT = 'This slug is already in use.';

export function isValidSlug(slug: string): boolean {
  return slug.length <= SLUG_MAX_LENGTH && SLUG_PATTERN.test(slug);
}

export function slugConflict(): ConflictException {
  return new ConflictException({
    error: SLUG_CONFLICT,
    fields: { slug: [SLUG_CONFLICT] },
  });
}

export interface SlugLookup {
  findUnique(args: {
    where: { slug: string };
  }): PromiseLike<{ id: number } | null>;
}

// Checked before saving so the owner gets a field error; the unique index
// (P2002, mapped by HttpExceptionFilter) still covers concurrent saves.
export async function assertSlugFree(
  model: SlugLookup,
  slug: string,
  exceptId?: number,
): Promise<void> {
  const existing = await model.findUnique({ where: { slug } });
  if (existing && existing.id !== exceptId) throw slugConflict();
}

export function slugEsConflict(): ConflictException {
  return new ConflictException({
    error: SLUG_CONFLICT,
    fields: { slugEs: [SLUG_CONFLICT] },
  });
}

export interface UrlSlugLookup {
  findFirst(args: {
    where: Record<string, unknown>;
  }): PromiseLike<{ id: number } | null>;
}

// RF-170: an item's Spanish URL slug (slugEs, or slug without one) must not be
// the Spanish URL slug of another item of the collection. Checked before saving
// for the field error; the coalesce(slug_es, slug) unique index still covers
// concurrent saves (P2002, mapped by HttpExceptionFilter).
export async function assertUrlSlugFree(
  model: UrlSlugLookup,
  item: { slug: string; slugEs?: string | null },
  exceptId?: number,
): Promise<void> {
  const urlSlug = item.slugEs ?? item.slug;
  const existing = await model.findFirst({
    where: {
      OR: [{ slugEs: urlSlug }, { slugEs: null, slug: urlSlug }],
      ...(exceptId === undefined ? {} : { id: { not: exceptId } }),
    },
  });
  if (existing) throw slugEsConflict();
}
