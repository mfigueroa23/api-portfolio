import { GUARDS_METADATA } from '@nestjs/common/constants.js';
import type { Request, Response } from 'express';
import { JwtAuthGuard } from '../auth/guards/jwt-auth.guard.js';
import { FileReferencesService } from './file-references.service.js';
import { FilesController } from './files.controller.js';
import { FilesService } from './files.service.js';

function guardsOf(method: keyof FilesController): unknown {
  const handler: unknown = Object.getOwnPropertyDescriptor(
    FilesController.prototype,
    method,
  )?.value;
  return Reflect.getMetadata(GUARDS_METADATA, handler as object);
}

describe('FilesController', () => {
  const files = {
    store: vi.fn(),
    list: vi.fn(),
    read: vi.fn(),
    urlOf: vi.fn(),
    remove: vi.fn(),
  };
  const references = { find: vi.fn() };
  const controller = new FilesController(
    files as unknown as FilesService,
    references as unknown as FileReferencesService,
  );
  const id = '2b1e0a4c-5d3f-4e2a-9b8c-7d6e5f4a3b2c';

  beforeEach(() => {
    [...Object.values(files), references.find].forEach((fn) => fn.mockReset());
  });

  it('only leaves the public read without a guard', () => {
    expect(guardsOf('read')).toBeUndefined();
    for (const method of ['upload', 'list', 'references', 'remove'] as const) {
      expect(guardsOf(method)).toEqual([JwtAuthGuard]);
    }
  });

  it('stores the raw body under the given name', async () => {
    const body = Buffer.from('x');
    files.store.mockResolvedValue({ id });

    await expect(
      controller.upload({ name: 'a.png' }, { body } as Request),
    ).resolves.toEqual({ id });
    expect(files.store).toHaveBeenCalledWith('a.png', body);
  });

  it('lists a page, first page and every type by default', async () => {
    files.list.mockResolvedValue({ items: [] });

    await controller.list({});
    await controller.list({ page: 3, type: 'pdf' });

    expect(files.list.mock.calls).toEqual([
      [1, undefined],
      [3, 'pdf'],
    ]);
  });

  it('sends the bytes with the file headers', async () => {
    const data = Buffer.from('<svg/>');
    files.read.mockResolvedValue({
      data,
      mime: 'image/svg+xml',
      name: 'a.svg',
    });
    const res = { set: vi.fn().mockReturnThis(), send: vi.fn() };

    await controller.read(id, res as unknown as Response);

    expect(res.set).toHaveBeenCalledWith(
      expect.objectContaining({
        'Content-Type': 'image/svg+xml',
        'X-Content-Type-Options': 'nosniff',
      }),
    );
    expect(res.send).toHaveBeenCalledWith(data);
  });

  it('looks references up by the file URL', async () => {
    const found = [{ collection: 'posts', id: 1, title: 'A', status: 'draft' }];
    files.urlOf.mockResolvedValue(`https://api.example.com/files/${id}`);
    references.find.mockResolvedValue(found);

    await expect(controller.references(id)).resolves.toEqual(found);
    expect(files.urlOf).toHaveBeenCalledWith(id);
    expect(references.find).toHaveBeenCalledWith(
      `https://api.example.com/files/${id}`,
    );
  });

  it('removes through the service', async () => {
    files.remove.mockResolvedValue(undefined);

    await expect(controller.remove(id)).resolves.toBeUndefined();
    expect(files.remove).toHaveBeenCalledWith(id);
  });
});
