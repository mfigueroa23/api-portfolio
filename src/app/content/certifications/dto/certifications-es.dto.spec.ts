import { plainToInstance } from 'class-transformer';
import { validate } from 'class-validator';
import { CertificationDto } from './certifications.dto.js';

const valid = {
  position: 0,
  name: 'CKA',
  issuer: 'CNCF',
  issueDate: '2025-03-14',
};

async function errorsFor(body: Record<string, unknown>) {
  const dto = plainToInstance(CertificationDto, body);
  const errors = await validate(dto, { whitelist: true });
  return { dto, fields: errors.map((error) => error.property) };
}

// Spanish versions are optional and follow their English field's limit.
describe('CertificationDto Spanish fields', () => {
  it.each([['nameEs', 200]] as [string, number][])(
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

  it.each([['nameEs', 200]] as [string, number][])(
    'stores an empty %s as null and accepts it missing',
    async (field) => {
      const { dto, fields } = await errorsFor({ ...valid, [field]: '' });

      expect(fields).toEqual([]);
      expect((dto as unknown as Record<string, unknown>)[field]).toBeNull();
      expect((await errorsFor(valid)).fields).toEqual([]);
    },
  );

  it('rejects a Spanish value that is not text', async () => {
    const [[field]] = [['nameEs', 200]] as [string, number][];

    expect((await errorsFor({ ...valid, [field]: 7 })).fields).toEqual([field]);
  });
});
