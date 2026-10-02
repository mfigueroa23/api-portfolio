import { PrismaService } from '../database/prisma.service.js';
import { PropertiesService } from './properties.service.js';

describe('PropertiesService', () => {
  const findUnique = vi.fn();
  const service = new PropertiesService({
    property: { findUnique },
  } as unknown as PrismaService);

  beforeEach(() => {
    findUnique.mockReset();
  });

  it('returns the value of an existing key', async () => {
    findUnique.mockResolvedValue({ key: 'jwt_secret', value: 'secret' });

    await expect(service.get('jwt_secret')).resolves.toBe('secret');
    expect(findUnique).toHaveBeenCalledWith({ where: { key: 'jwt_secret' } });
  });

  it('returns null for a missing key', async () => {
    findUnique.mockResolvedValue(null);

    await expect(service.get('brevo_api_key')).resolves.toBeNull();
  });

  it('reads the table on every call so SQL edits apply without a restart', async () => {
    findUnique
      .mockResolvedValueOnce({ key: 'k', value: 'old' })
      .mockResolvedValueOnce({ key: 'k', value: 'new' });

    await expect(service.get('k')).resolves.toBe('old');
    await expect(service.get('k')).resolves.toBe('new');
    expect(findUnique).toHaveBeenCalledTimes(2);
  });
});
