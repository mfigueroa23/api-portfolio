import { GUARDS_METADATA } from '@nestjs/common/constants.js';
import { JwtAuthGuard } from '../../auth/guards/jwt-auth.guard.js';
import { ContactInfoDto } from './dto/contact-info.dto.js';
import { ContactInfoController } from './contact-info.controller.js';
import { ContactInfoService } from './contact-info.service.js';

const item = {
  position: 0,
  icon: 'fa-solid fa-envelope',
  label: 'Email',
  value: 'me@example.com',
  href: 'mailto:me@example.com',
} satisfies ContactInfoDto;
const row = { id: 1, ...item };

// Nest stores guard metadata on the method function itself.
function guardsOf(method: keyof ContactInfoController): unknown {
  const handler: unknown = Object.getOwnPropertyDescriptor(
    ContactInfoController.prototype,
    method,
  )?.value;
  return Reflect.getMetadata(GUARDS_METADATA, handler as object);
}

describe('ContactInfoController', () => {
  const service = {
    list: vi.fn(),
    create: vi.fn(),
    update: vi.fn(),
    remove: vi.fn(),
  };
  const controller = new ContactInfoController(
    service as unknown as ContactInfoService,
  );

  beforeEach(() => {
    Object.values(service).forEach((fn) => fn.mockReset());
  });

  it('lists the items without a guard', async () => {
    service.list.mockResolvedValue([row]);

    await expect(controller.list()).resolves.toEqual([row]);
    expect(guardsOf('list')).toBeUndefined();
  });

  it.each(['create', 'update', 'remove'] as const)(
    'protects %s with JwtAuthGuard',
    (method) => {
      expect(guardsOf(method)).toEqual([JwtAuthGuard]);
    },
  );

  it('creates through the service', async () => {
    service.create.mockResolvedValue(row);

    await expect(controller.create(item)).resolves.toEqual(row);
    expect(service.create).toHaveBeenCalledWith(item);
  });

  it('updates through the service', async () => {
    service.update.mockResolvedValue(row);

    await expect(controller.update(1, item)).resolves.toEqual(row);
    expect(service.update).toHaveBeenCalledWith(1, item);
  });

  it('removes through the service', async () => {
    service.remove.mockResolvedValue(undefined);

    await expect(controller.remove(1)).resolves.toBeUndefined();
    expect(service.remove).toHaveBeenCalledWith(1);
  });
});
