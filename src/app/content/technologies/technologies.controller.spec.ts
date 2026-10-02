import { GUARDS_METADATA } from '@nestjs/common/constants.js';
import { JwtAuthGuard } from '../../auth/guards/jwt-auth.guard.js';
import { TechnologyDto } from './dto/technologies.dto.js';
import { TechnologiesController } from './technologies.controller.js';
import { TechnologiesService } from './technologies.service.js';

const item = {
  position: 0,
  name: 'Angular',
} satisfies TechnologyDto;
const row = { id: 1, ...item };

// Nest stores guard metadata on the method function itself.
function guardsOf(method: keyof TechnologiesController): unknown {
  const handler: unknown = Object.getOwnPropertyDescriptor(
    TechnologiesController.prototype,
    method,
  )?.value;
  return Reflect.getMetadata(GUARDS_METADATA, handler as object);
}

describe('TechnologiesController', () => {
  const service = {
    list: vi.fn(),
    create: vi.fn(),
    update: vi.fn(),
    remove: vi.fn(),
  };
  const controller = new TechnologiesController(
    service as unknown as TechnologiesService,
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
