import { HttpStatus } from '@nestjs/common';
import {
  GUARDS_METADATA,
  HTTP_CODE_METADATA,
  PATH_METADATA,
} from '@nestjs/common/constants.js';
import { JwtAuthGuard } from '../../auth/guards/jwt-auth.guard.js';
import { CreateTestimonialDto } from './dto/testimonials.dto.js';
import { TestimonialsController } from './testimonials.controller.js';
import { TestimonialsService } from './testimonials.service.js';

const item = {
  quote: 'Great work.',
  author: 'Grace Hopper',
  role: 'Admiral',
} satisfies CreateTestimonialDto;
const row = { id: 1, ...item };

// Nest stores route metadata on the method function itself.
function metadataOf(
  key: string,
  method: keyof TestimonialsController,
): unknown {
  const handler: unknown = Object.getOwnPropertyDescriptor(
    TestimonialsController.prototype,
    method,
  )?.value;
  return Reflect.getMetadata(key, handler as object);
}

describe('TestimonialsController', () => {
  const service = {
    listApproved: vi.fn(),
    listAll: vi.fn(),
    pendingCount: vi.fn(),
    create: vi.fn(),
    update: vi.fn(),
    approve: vi.fn(),
    remove: vi.fn(),
  };
  const controller = new TestimonialsController(
    service as unknown as TestimonialsService,
  );

  beforeEach(() => {
    Object.values(service).forEach((fn) => fn.mockReset());
  });

  it('lists the approved items without a guard', async () => {
    service.listApproved.mockResolvedValue([row]);

    await expect(controller.list()).resolves.toEqual([row]);
    expect(metadataOf(GUARDS_METADATA, 'list')).toBeUndefined();
  });

  it('passes the requested language to the public list', async () => {
    service.listApproved.mockResolvedValue([]);

    await controller.list({ lang: 'es' });
    await controller.list();

    expect(service.listApproved.mock.calls).toEqual([['es'], ['en']]);
  });

  it.each([
    'listAll',
    'pendingCount',
    'create',
    'update',
    'approve',
    'remove',
  ] as const)('protects %s with JwtAuthGuard', (method) => {
    expect(metadataOf(GUARDS_METADATA, method)).toEqual([JwtAuthGuard]);
  });

  it('declares /all and /pending-count before /:id routes', () => {
    const paths = Object.getOwnPropertyNames(TestimonialsController.prototype)
      .filter((name) => name !== 'constructor')
      .map((name) =>
        metadataOf(PATH_METADATA, name as keyof TestimonialsController),
      );

    expect(paths.indexOf('all')).toBeLessThan(paths.indexOf(':id'));
    expect(paths.indexOf('pending-count')).toBeLessThan(paths.indexOf(':id'));
  });

  it('lists every item for the owner', async () => {
    service.listAll.mockResolvedValue([row]);

    await expect(controller.listAll()).resolves.toEqual([row]);
  });

  it('answers the pending count', async () => {
    service.pendingCount.mockResolvedValue({ count: 3 });

    await expect(controller.pendingCount()).resolves.toEqual({ count: 3 });
  });

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

  it('approves through the service and answers 200', async () => {
    service.approve.mockResolvedValue(row);

    await expect(controller.approve(1, item)).resolves.toEqual(row);
    expect(service.approve).toHaveBeenCalledWith(1, item);
    expect(metadataOf(HTTP_CODE_METADATA, 'approve')).toBe(HttpStatus.OK);
  });

  it('removes (rejects) through the service and answers 204', async () => {
    service.remove.mockResolvedValue(undefined);

    await expect(controller.remove(1)).resolves.toBeUndefined();
    expect(service.remove).toHaveBeenCalledWith(1);
    expect(metadataOf(HTTP_CODE_METADATA, 'remove')).toBe(
      HttpStatus.NO_CONTENT,
    );
  });
});
