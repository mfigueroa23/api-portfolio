import { plainToInstance } from 'class-transformer';
import { validate } from 'class-validator';
import { SendContactDto } from './send-contact.dto.js';

const valid = {
  name: 'Ada Lovelace',
  email: 'ada@example.com',
  message: 'Hello!',
};

async function errorsFor(body: Record<string, unknown>) {
  const dto = plainToInstance(SendContactDto, body);
  const errors = await validate(dto, { whitelist: true });
  return { dto, fields: errors.map((error) => error.property) };
}

describe('SendContactDto', () => {
  it('accepts a valid message', async () => {
    expect((await errorsFor(valid)).fields).toEqual([]);
  });

  it('trims every field before validating', async () => {
    const { dto, fields } = await errorsFor({
      name: '  Ada  ',
      email: ' ada@example.com\n',
      message: '\tHello!  ',
    });

    expect(fields).toEqual([]);
    expect(dto).toMatchObject({
      name: 'Ada',
      email: 'ada@example.com',
      message: 'Hello!',
    });
  });

  it.each([
    ['name', 'a'.repeat(100)],
    ['email', `${'a'.repeat(188)}@example.com`],
    ['message', 'a'.repeat(5000)],
  ])('accepts %s at its maximum length', async (field, value) => {
    expect(value.length).toBe({ name: 100, email: 200, message: 5000 }[field]);
    expect((await errorsFor({ ...valid, [field]: value })).fields).toEqual([]);
  });

  it.each([
    ['name', 'a'.repeat(101)],
    ['email', `${'a'.repeat(189)}@example.com`],
    ['message', 'a'.repeat(5001)],
  ])('rejects %s one character over its maximum', async (field, value) => {
    expect((await errorsFor({ ...valid, [field]: value })).fields).toEqual([
      field,
    ]);
  });

  it.each(['name', 'email', 'message'])(
    'rejects %s when it is only whitespace',
    async (field) => {
      expect((await errorsFor({ ...valid, [field]: '   ' })).fields).toEqual([
        field,
      ]);
    },
  );

  it.each(['name', 'email', 'message'])(
    'rejects %s when it is missing',
    async (field) => {
      const body: Record<string, unknown> = { ...valid };
      delete body[field];
      expect((await errorsFor(body)).fields).toEqual([field]);
    },
  );

  it.each([
    ['name', 42],
    ['email', ['ada@example.com']],
    ['message', { text: 'hi' }],
    ['name', null],
  ])('rejects %s when it is not text (%j)', async (field, value) => {
    expect((await errorsFor({ ...valid, [field]: value })).fields).toEqual([
      field,
    ]);
  });

  it.each([
    'ada',
    'ada@example',
    'ada @example.com',
    '@example.com',
    'a@b@c.d',
  ])('rejects the invalid email %j', async (email) => {
    expect((await errorsFor({ ...valid, email })).fields).toEqual(['email']);
  });

  it('accepts the optional honeypot field', async () => {
    expect((await errorsFor({ ...valid, website: '' })).fields).toEqual([]);
  });
});
