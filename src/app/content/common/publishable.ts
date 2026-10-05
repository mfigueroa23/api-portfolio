import { BadRequestException } from '@nestjs/common';

export interface PublishChange {
  status: 'published';
  publishedAt: Date;
}

// The first publication date is kept forever, so republishing an item does
// not move it to the top of the listings.
export function publish(
  item: { publishedAt: Date | null },
  now = new Date(),
): PublishChange {
  return { status: 'published', publishedAt: item.publishedAt ?? now };
}

export function unpublish(): { status: 'draft' } {
  return { status: 'draft' };
}

function isEmpty(value: unknown): boolean {
  if (value === null || value === undefined) return true;
  if (typeof value === 'string') return value.trim() === '';
  if (Array.isArray(value)) return value.length === 0;
  return false;
}

// Drafts may leave fields empty; publishing (or saving a published item)
// requires them, with one field error per empty field.
export function assertComplete(
  item: Record<string, unknown>,
  required: readonly string[],
): void {
  const fields: Record<string, string[]> = {};
  for (const field of required) {
    if (isEmpty(item[field])) {
      fields[field] = [`${field} is required to publish.`];
    }
  }
  if (Object.keys(fields).length > 0) {
    throw new BadRequestException({ error: 'Validation failed.', fields });
  }
}
