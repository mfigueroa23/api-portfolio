import { GUARDS_METADATA } from '@nestjs/common/constants.js';
import { JwtAuthGuard } from '../../auth/guards/jwt-auth.guard.js';
import { HighlightDto } from './dto/highlights.dto.js';
import { HighlightsController } from './highlights.controller.js';
import { HighlightsService } from './highlights.service.js';

const item = {
  position: 0,
  icon: 'fa-solid fa-code',
  title: 'Clean Code',
  description: 'Readable code.',
} satisfies HighlightDto;
const row = { id: 1, ...item };

// Nest stores guard metadata on the method function itself.
function guardsOf(method: keyof HighlightsController): unknown {
  const handler: unknown = Object.getOwnPropertyDescriptor(
    HighlightsController.prototype,
    method,
  )?.value;
  return Reflect.getMetadata(GUARDS_METADATA, handler as object);
}

describe('HighlightsController', () => {
  const service = {
    list: vi.fn(),
    listAll: vi.fn(),
    create: vi.fn(),
    update: vi.fn(),
    remove: vi.fn(),
  };
  const controller = new HighlightsController(
    service as unknown as HighlightsService,
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

  it('passes the requested language to the public list', async () => {
    service.list.mockResolvedValue([]);

    await controller.list({ lang: 'es' });
    await controller.list({ lang: 'fr' as 'es' });
    await controller.list();

    expect(service.list.mock.calls).toEqual([['es'], ['en'], ['en']]);
  });

  it('lists every item for the owner behind JwtAuthGuard', async () => {
    service.listAll.mockResolvedValue([row]);

    await expect(controller.listAll()).resolves.toEqual([row]);
    expect(guardsOf('listAll')).toEqual([JwtAuthGuard]);
  });
});
