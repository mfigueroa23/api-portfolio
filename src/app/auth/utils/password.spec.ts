import { hashPassword } from '../../../../test/utils/hash-password.js';
import { verifyPassword } from './password.js';

describe('verifyPassword', () => {
  const stored = hashPassword('correct horse battery staple');

  it('accepts the right password', async () => {
    await expect(
      verifyPassword('correct horse battery staple', stored),
    ).resolves.toBe(true);
  });

  it('rejects a wrong password', async () => {
    await expect(
      verifyPassword('Correct horse battery staple', stored),
    ).resolves.toBe(false);
  });

  it.each([
    ['empty', ''],
    ['plain text', 'not-a-hash'],
    ['another algorithm', stored.replace('scrypt$', 'bcrypt$')],
    ['missing hash', 'scrypt$c2FsdA=='],
    ['empty salt and hash', 'scrypt$$'],
    ['extra segment', `${stored}$extra`],
  ])(
    'returns false for a malformed stored value (%s)',
    async (_label, value) => {
      await expect(verifyPassword('anything', value)).resolves.toBe(false);
    },
  );
});
