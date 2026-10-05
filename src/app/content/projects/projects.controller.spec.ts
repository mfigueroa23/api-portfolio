import { GUARDS_METADATA } from '@nestjs/common/constants.js';
import { JwtAuthGuard } from '../../auth/guards/jwt-auth.guard.js';
import { ProjectDto } from './dto/projects.dto.js';
import { ProjectsController } from './projects.controller.js';
import { ProjectsService } from './projects.service.js';

const item = {
  slug: 'portfolio',
  title: 'Portfolio',
} satisfies ProjectDto;
const row = { id: 1, ...item };

// Nest stores guard metadata on the method function itself.
function guardsOf(method: keyof ProjectsController): unknown {
  const handler: unknown = Object.getOwnPropertyDescriptor(
    ProjectsController.prototype,
    method,
  )?.value;
  return Reflect.getMetadata(GUARDS_METADATA, handler as object);
}

describe('ProjectsController', () => {
  const service = {
    listPublished: vi.fn(),
    listAll: vi.fn(),
    findPublishedBySlug: vi.fn(),
    create: vi.fn(),
    update: vi.fn(),
    publish: vi.fn(),
    unpublish: vi.fn(),
    remove: vi.fn(),
  };
  const controller = new ProjectsController(
    service as unknown as ProjectsService,
  );

  beforeEach(() => {
    Object.values(service).forEach((fn) => fn.mockReset());
  });

  it.each(['list', 'findBySlug'] as const)('leaves %s public', (method) => {
    expect(guardsOf(method)).toBeUndefined();
  });

  it.each([
    'listAll',
    'create',
    'update',
    'publish',
    'unpublish',
    'remove',
  ] as const)('protects %s with JwtAuthGuard', (method) => {
    expect(guardsOf(method)).toEqual([JwtAuthGuard]);
  });

  it('lists published projects with the optional limit', async () => {
    service.listPublished.mockResolvedValue([row]);

    await expect(controller.list({ limit: 4 })).resolves.toEqual([row]);
    await controller.list({});
    expect(service.listPublished.mock.calls).toEqual([[4], [undefined]]);
  });

  it('lists every project for the owner', async () => {
    service.listAll.mockResolvedValue([row]);

    await expect(controller.listAll()).resolves.toEqual([row]);
  });

  it('finds a published project by slug', async () => {
    service.findPublishedBySlug.mockResolvedValue(row);

    await expect(controller.findBySlug('portfolio')).resolves.toEqual(row);
    expect(service.findPublishedBySlug).toHaveBeenCalledWith('portfolio');
  });

  it('creates and updates through the service', async () => {
    service.create.mockResolvedValue(row);
    service.update.mockResolvedValue(row);

    await expect(controller.create(item)).resolves.toEqual(row);
    await expect(controller.update(1, item)).resolves.toEqual(row);
    expect(service.create).toHaveBeenCalledWith(item);
    expect(service.update).toHaveBeenCalledWith(1, item);
  });

  it('publishes and unpublishes through the service', async () => {
    service.publish.mockResolvedValue(row);
    service.unpublish.mockResolvedValue(row);

    await expect(controller.publish(1)).resolves.toEqual(row);
    await expect(controller.unpublish(1)).resolves.toEqual(row);
    expect(service.publish).toHaveBeenCalledWith(1);
    expect(service.unpublish).toHaveBeenCalledWith(1);
  });

  it('removes through the service', async () => {
    service.remove.mockResolvedValue(undefined);

    await expect(controller.remove(1)).resolves.toBeUndefined();
    expect(service.remove).toHaveBeenCalledWith(1);
  });
});
