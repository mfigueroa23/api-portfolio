import { BadRequestException } from '@nestjs/common';
import { assertComplete, publish, unpublish } from './publishable.js';

describe('publish helpers', () => {
  it('records the first publication date', () => {
    const now = new Date('2026-10-04T12:00:00Z');

    expect(publish({ publishedAt: null }, now)).toEqual({
      status: 'published',
      publishedAt: now,
    });
  });

  it('keeps the first publication date when publishing again', () => {
    const first = new Date('2026-01-01T00:00:00Z');

    expect(
      publish({ publishedAt: first }, new Date('2026-10-04T00:00:00Z')),
    ).toEqual({ status: 'published', publishedAt: first });
  });

  it('returns to draft without touching the publication date', () => {
    expect(unpublish()).toEqual({ status: 'draft' });
  });
});

describe('assertComplete', () => {
  it('passes when every required field has a value', () => {
    expect(() =>
      assertComplete({ title: 'A', summary: 'S', tags: ['x'] }, [
        'title',
        'summary',
        'tags',
      ]),
    ).not.toThrow();
  });

  it('answers 400 with one field error per empty required field', () => {
    let error: unknown;
    try {
      assertComplete(
        { title: 'A', description: null, image: '  ', body: '', tags: [] },
        ['title', 'description', 'image', 'body', 'tags', 'summary'],
      );
    } catch (caught) {
      error = caught;
    }

    expect(error).toBeInstanceOf(BadRequestException);
    const body = (error as BadRequestException).getResponse() as {
      error: string;
      fields: Record<string, string[]>;
    };
    expect(body.error).toBe('Validation failed.');
    expect(Object.keys(body.fields)).toEqual([
      'description',
      'image',
      'body',
      'tags',
      'summary',
    ]);
    expect(body.fields.description).toEqual([
      'description is required to publish.',
    ]);
  });
});
