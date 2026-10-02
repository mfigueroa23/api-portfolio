import { randomBytes, scryptSync } from 'node:crypto';

// Test-only counterpart of verifyPassword: produces the same
// `scrypt$<salt-b64>$<hash-b64>` format the README one-liner generates.
export function hashPassword(plain: string): string {
  const salt = randomBytes(16);
  const hash = scryptSync(plain, salt, 64);
  return `scrypt$${salt.toString('base64')}$${hash.toString('base64')}`;
}
