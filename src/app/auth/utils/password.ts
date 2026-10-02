import { scrypt, timingSafeEqual } from 'node:crypto';

// Upper bound on the derived key length read from the stored value, so a
// corrupted row cannot make scrypt allocate an arbitrary amount of memory.
const MAX_KEY_LENGTH = 128;

function deriveKey(
  plain: string,
  salt: Buffer,
  length: number,
): Promise<Buffer> {
  return new Promise((resolve, reject) => {
    scrypt(plain, salt, length, (error, key) =>
      error ? reject(error) : resolve(key),
    );
  });
}

// Checks a password against a `scrypt$<salt-b64>$<hash-b64>` value (scrypt with
// Node's default cost parameters). Malformed values never match.
export async function verifyPassword(
  plain: string,
  stored: string,
): Promise<boolean> {
  const [algorithm, salt64, hash64, ...rest] = stored.split('$');
  if (algorithm !== 'scrypt' || !salt64 || !hash64 || rest.length > 0) {
    return false;
  }
  const salt = Buffer.from(salt64, 'base64');
  const expected = Buffer.from(hash64, 'base64');
  if (expected.length === 0 || expected.length > MAX_KEY_LENGTH) return false;

  const actual = await deriveKey(plain, salt, expected.length);
  return timingSafeEqual(actual, expected);
}
