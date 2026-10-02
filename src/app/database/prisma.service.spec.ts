import { PrismaPg } from '@prisma/adapter-pg';
import { PrismaService } from './prisma.service.js';

// The adapter is mocked so no connection to a real database is attempted.
vi.mock('@prisma/adapter-pg', () => ({
  PrismaPg: vi.fn(function (this: Record<string, unknown>, options: unknown) {
    this.options = options;
    this.provider = 'postgres';
    this.adapterName = '@prisma/adapter-pg';
  }),
}));

describe('PrismaService', () => {
  const originalUrl = process.env.DATABASE_URL;

  beforeEach(() => {
    vi.mocked(PrismaPg).mockClear();
    process.env.DATABASE_URL = 'postgresql://user:pass@db.test:5432/app';
  });

  afterEach(() => {
    process.env.DATABASE_URL = originalUrl;
  });

  it('builds the pg adapter with DATABASE_URL from the environment', () => {
    new PrismaService();

    expect(PrismaPg).toHaveBeenCalledWith({
      connectionString: 'postgresql://user:pass@db.test:5432/app',
    });
  });

  it('connects on module init and disconnects on module destroy', async () => {
    const service = new PrismaService();
    const connect = vi.spyOn(service, '$connect').mockResolvedValue();
    const disconnect = vi.spyOn(service, '$disconnect').mockResolvedValue();

    await service.onModuleInit();
    await service.onModuleDestroy();

    expect(connect).toHaveBeenCalledTimes(1);
    expect(disconnect).toHaveBeenCalledTimes(1);
  });
});
