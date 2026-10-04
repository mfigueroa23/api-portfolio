import { PrismaFake } from '../../../../test/fakes/prisma.fake.js';
import { PrismaService } from '../../database/prisma.service.js';
import { CertificationsService } from './certifications.service.js';
import { CertificationDto } from './dto/certifications.dto.js';

const item = {
  position: 0,
  name: 'CKA',
  issuer: 'CNCF',
  issueDate: '2025-03-14',
  expiryDate: '2028-03-14',
  credentialId: 'ABC',
  verificationUrl: 'https://verify.example.com/ABC',
  fileUrl: 'https://api.figueroa-sanchez.com/files/1',
} satisfies CertificationDto;

describe('CertificationsService', () => {
  let prisma: PrismaFake;
  let service: CertificationsService;

  beforeEach(() => {
    prisma = new PrismaFake();
    service = new CertificationsService(prisma as unknown as PrismaService);
  });

  it('lists items ordered by position, then id', async () => {
    for (const position of [2, 0, 2, 1]) {
      await service.create({ ...item, position });
    }

    expect((await service.list()).map((row) => row.id)).toEqual([2, 4, 1, 3]);
  });

  it('stores calendar dates and returns them unchanged as YYYY-MM-DD', async () => {
    const created = await service.create(item);

    expect(prisma.certification.rows[0]).toMatchObject({
      issueDate: new Date('2025-03-14T00:00:00Z'),
      expiryDate: new Date('2028-03-14T00:00:00Z'),
    });
    expect(created).toMatchObject({ id: 1, ...item });
    expect((await service.list())[0]).toMatchObject(item);
  });

  it('stores absent optional fields as null', async () => {
    const created = await service.create({
      position: 0,
      name: 'CKA',
      issuer: 'CNCF',
      issueDate: '2025-03-14',
    });

    expect(created).toMatchObject({
      expiryDate: null,
      credentialId: null,
      verificationUrl: null,
      fileUrl: null,
    });
  });

  it('updates and removes an item', async () => {
    const created = await service.create(item);

    await expect(
      service.update(created.id, { ...item, expiryDate: null }),
    ).resolves.toMatchObject({ expiryDate: null });
    await service.remove(created.id);

    expect(await service.list()).toEqual([]);
  });

  it('rejects with P2025 when the item does not exist', async () => {
    await expect(service.update(99, item)).rejects.toMatchObject({
      code: 'P2025',
    });
    await expect(service.remove(99)).rejects.toMatchObject({ code: 'P2025' });
  });
});
