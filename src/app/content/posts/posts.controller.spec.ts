import { GUARDS_METADATA } from '@nestjs/common/constants.js';
import { JwtAuthGuard } from '../../auth/guards/jwt-auth.guard.js';
import { PostDto } from './dto/post.dto.js';
import { PostsController } from './posts.controller.js';
import { PostsService } from './posts.service.js';

const item = { title: 'Hello', slug: 'hello' } satisfies PostDto;
const row = { id: 1, ...item };

function guardsOf(method: keyof PostsController): unknown {
  const handler: unknown = Object.getOwnPropertyDescriptor(
    PostsController.prototype,
    method,
  )?.value;
  return Reflect.getMetadata(GUARDS_METADATA, handler as object);
}

describe('PostsController', () => {
  const service = {
    listPublished: vi.fn(),
    feed: vi.fn(),
    listAll: vi.fn(),
    findPublishedBySlug: vi.fn(),
    create: vi.fn(),
    update: vi.fn(),
    publish: vi.fn(),
    unpublish: vi.fn(),
    remove: vi.fn(),
  };
  const controller = new PostsController(service as unknown as PostsService);

  beforeEach(() => {
    Object.values(service).forEach((fn) => fn.mockReset());
  });

  it.each(['list', 'feed', 'findBySlug'] as const)(
    'leaves %s public',
    (method) => {
      expect(guardsOf(method)).toBeUndefined();
    },
  );

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

  it('declares /feed and /all before /:slug', () => {
    const order = Object.getOwnPropertyNames(PostsController.prototype);

    expect(order.indexOf('feed')).toBeLessThan(order.indexOf('findBySlug'));
    expect(order.indexOf('listAll')).toBeLessThan(order.indexOf('findBySlug'));
  });

  it('lists a page, first page and no tag by default', async () => {
    service.listPublished.mockResolvedValue({ items: [] });

    await controller.list({});
    await controller.list({ page: 2, tag: 'web-dev' });

    expect(service.listPublished.mock.calls).toEqual([
      [{ page: 1, tag: undefined, lang: 'en' }],
      [{ page: 2, tag: 'web-dev', lang: 'en' }],
    ]);
  });

  it('delegates the reads', async () => {
    service.feed.mockResolvedValue([row]);
    service.listAll.mockResolvedValue([row]);
    service.findPublishedBySlug.mockResolvedValue(row);

    await expect(controller.feed()).resolves.toEqual([row]);
    await expect(controller.listAll()).resolves.toEqual([row]);
    await expect(controller.findBySlug('hello')).resolves.toEqual(row);
    expect(service.findPublishedBySlug).toHaveBeenCalledWith('hello', 'en');
  });

  it('passes the requested language to every public read', async () => {
    service.listPublished.mockResolvedValue({ items: [] });

    await controller.list({ page: 1, lang: 'es' });
    await controller.feed({ lang: 'es' });
    await controller.findBySlug('hola', { lang: 'es' });

    expect(service.listPublished).toHaveBeenCalledWith({
      page: 1,
      tag: undefined,
      lang: 'es',
    });
    expect(service.feed).toHaveBeenCalledWith('es');
    expect(service.findPublishedBySlug).toHaveBeenCalledWith('hola', 'es');
  });

  it('delegates the writes', async () => {
    for (const fn of [
      service.create,
      service.update,
      service.publish,
      service.unpublish,
    ]) {
      fn.mockResolvedValue(row);
    }
    service.remove.mockResolvedValue(undefined);

    await expect(controller.create(item)).resolves.toEqual(row);
    await expect(controller.update(1, item)).resolves.toEqual(row);
    await expect(controller.publish(1)).resolves.toEqual(row);
    await expect(controller.unpublish(1)).resolves.toEqual(row);
    await expect(controller.remove(1)).resolves.toBeUndefined();
    expect(service.update).toHaveBeenCalledWith(1, item);
    expect(service.remove).toHaveBeenCalledWith(1);
  });
});
