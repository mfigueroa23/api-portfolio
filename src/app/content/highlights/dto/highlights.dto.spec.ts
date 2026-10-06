import { plainToInstance } from 'class-transformer';
import { validate } from 'class-validator';
import { HighlightDto } from './highlights.dto.js';

const valid = {
  position: 0,
  icon: 'fa-solid fa-code',
  title: 'Clean Code',
  description: 'Readable code.',
};

async function errorsFor(body: Record<string, unknown>) {
  const dto = plainToInstance(HighlightDto, body);
  const errors = await validate(dto, { whitelist: true });
  return { dto, fields: errors.map((error) => error.property) };
}

// Spanish versions are optional and follow their English field's limit.
describe('HighlightDto Spanish fields', () => {
  it.each([
    ['titleEs', 200],
    ['descriptionEs', 5000],
  ] as [string, number][])(
    'accepts %s up to %i characters and rejects one more',
    async (field, max) => {
      expect(
        (await errorsFor({ ...valid, [field]: 'a'.repeat(max) })).fields,
      ).toEqual([]);
      expect(
        (await errorsFor({ ...valid, [field]: 'a'.repeat(max + 1) })).fields,
      ).toEqual([field]);
    },
  );

  it.each([
    ['titleEs', 200],
    ['descriptionEs', 5000],
  ] as [string, number][])(
    'stores an empty %s as null and accepts it missing',
    async (field) => {
      const { dto, fields } = await errorsFor({ ...valid, [field]: '' });

      expect(fields).toEqual([]);
      expect((dto as unknown as Record<string, unknown>)[field]).toBeNull();
      expect((await errorsFor(valid)).fields).toEqual([]);
    },
  );

  it('rejects a Spanish value that is not text', async () => {
    const [[field]] = [
      ['titleEs', 200],
      ['descriptionEs', 5000],
    ] as [string, number][];

    expect((await errorsFor({ ...valid, [field]: 7 })).fields).toEqual([field]);
  });
});
