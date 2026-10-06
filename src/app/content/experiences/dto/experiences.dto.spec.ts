import { plainToInstance } from 'class-transformer';
import { validate } from 'class-validator';
import { ExperienceDto } from './experiences.dto.js';

const valid = {
  period: 'Jan 2026 — Present',
  role: 'Engineer',
  company: 'Acme',
  description: 'Builds things.',
  technologies: [],
  current: false,
  startDate: '2026-01',
};

async function errorsFor(body: Record<string, unknown>) {
  const dto = plainToInstance(ExperienceDto, body);
  const errors = await validate(dto, { whitelist: true });
  return { dto, fields: errors.map((error) => error.property) };
}

// Spanish versions are optional and follow their English field's limit.
describe('ExperienceDto Spanish fields', () => {
  it.each([
    ['periodEs', 100],
    ['roleEs', 200],
    ['descriptionEs', 5000],
    ['bodyEs', 100_000],
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
    ['periodEs', 100],
    ['roleEs', 200],
    ['descriptionEs', 5000],
    ['bodyEs', 100_000],
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
      ['periodEs', 100],
      ['roleEs', 200],
      ['descriptionEs', 5000],
      ['bodyEs', 100_000],
    ] as [string, number][];

    expect((await errorsFor({ ...valid, [field]: 7 })).fields).toEqual([field]);
  });
});
