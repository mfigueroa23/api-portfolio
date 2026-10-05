import { plainToInstance } from 'class-transformer';
import { validate } from 'class-validator';
import { CertificationDto } from './certifications.dto.js';

async function errorsFor(body: Record<string, unknown>) {
  const dto = plainToInstance(CertificationDto, body);
  const errors = await validate(dto, { whitelist: true });
  return { dto, fields: errors.map((error) => error.property) };
}

const valid = {
  position: 0,
  name: 'CKA',
  issuer: 'CNCF',
  issueDate: '2025-03-14',
};

describe('CertificationDto', () => {
  it('accepts the required fields alone', async () => {
    expect((await errorsFor(valid)).fields).toEqual([]);
  });

  it('accepts every optional field', async () => {
    const { fields } = await errorsFor({
      ...valid,
      expiryDate: '2028-03-14',
      credentialId: 'a'.repeat(100),
      verificationUrl: 'https://verify.example.com/x',
      fileUrl: 'http://localhost:3000/files/1',
    });

    expect(fields).toEqual([]);
  });

  it('requires position, name, issuer and issue date', async () => {
    expect((await errorsFor({})).fields).toEqual([
      'position',
      'name',
      'issuer',
      'issueDate',
    ]);
  });

  it('refuses an expiry date before the issue date', async () => {
    expect(
      (await errorsFor({ ...valid, expiryDate: '2025-03-13' })).fields,
    ).toEqual(['expiryDate']);
  });

  it('accepts an expiry date equal to the issue date', async () => {
    expect(
      (await errorsFor({ ...valid, expiryDate: '2025-03-14' })).fields,
    ).toEqual([]);
  });

  it.each(['2025-02-30', '2025-3-14', '2025-03-14T10:00:00Z', 'soon', ''])(
    'refuses the issue date %j',
    async (issueDate) => {
      expect((await errorsFor({ ...valid, issueDate })).fields).toEqual([
        'issueDate',
      ]);
    },
  );

  it('refuses too long texts and non-http URLs', async () => {
    const { fields } = await errorsFor({
      ...valid,
      name: 'a'.repeat(201),
      issuer: 'a'.repeat(201),
      credentialId: 'a'.repeat(101),
      verificationUrl: 'javascript:alert(1)',
      fileUrl: 'ftp://example.com/a.pdf',
    });

    expect(fields).toEqual([
      'name',
      'issuer',
      'credentialId',
      'verificationUrl',
      'fileUrl',
    ]);
  });

  it('turns empty optional fields into null', async () => {
    const { dto, fields } = await errorsFor({
      ...valid,
      expiryDate: '',
      credentialId: '',
      verificationUrl: '',
      fileUrl: '',
    });

    expect(fields).toEqual([]);
    expect(dto).toMatchObject({
      expiryDate: null,
      credentialId: null,
      verificationUrl: null,
      fileUrl: null,
    });
  });
});
