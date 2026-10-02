import { Logger } from '@nestjs/common';
import { PrismaService } from '../database/prisma.service.js';
import { CorsOriginsService } from './cors-origins.service.js';

describe('CorsOriginsService', () => {
  const findUnique = vi.fn();
  const service = new CorsOriginsService({
    corsOrigin: { findUnique },
  } as unknown as PrismaService);
  let logError: ReturnType<typeof vi.spyOn>;

  beforeEach(() => {
    findUnique.mockReset();
    logError = vi
      .spyOn(Logger.prototype, 'error')
      .mockImplementation(() => undefined);
  });

  afterEach(() => {
    vi.restoreAllMocks();
  });

  it('allows an enabled origin', async () => {
    findUnique.mockResolvedValue({ origin: 'https://a.test', enabled: true });

    await expect(service.isAllowed('https://a.test')).resolves.toBe(true);
    expect(findUnique).toHaveBeenCalledWith({
      where: { origin: 'https://a.test' },
    });
  });

  it('rejects a disabled origin', async () => {
    findUnique.mockResolvedValue({ origin: 'https://a.test', enabled: false });

    await expect(service.isAllowed('https://a.test')).resolves.toBe(false);
  });

  it('rejects a missing origin', async () => {
    findUnique.mockResolvedValue(null);

    await expect(service.isAllowed('http://localhost:4200')).resolves.toBe(
      false,
    );
  });

  it('rejects and logs when the database fails', async () => {
    findUnique.mockRejectedValue(new Error('connection refused'));

    await expect(service.isAllowed('https://a.test')).resolves.toBe(false);
    expect(logError).toHaveBeenCalled();
  });
});
