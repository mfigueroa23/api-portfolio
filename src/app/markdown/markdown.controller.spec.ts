import { GUARDS_METADATA } from '@nestjs/common/constants.js';
import { JwtAuthGuard } from '../auth/guards/jwt-auth.guard.js';
import { MarkdownController } from './markdown.controller.js';
import { MarkdownService } from './markdown.service.js';

describe('MarkdownController', () => {
  const service = { render: vi.fn() };
  const controller = new MarkdownController(
    service as unknown as MarkdownService,
  );

  it('renders through the service', () => {
    const rendered = { html: '<p>x</p>', toc: [], readingMinutes: 1 };
    service.render.mockReturnValue(rendered);

    expect(controller.render({ markdown: 'x' })).toEqual(rendered);
    expect(service.render).toHaveBeenCalledWith('x');
  });

  it('is protected with JwtAuthGuard', () => {
    const handler: unknown = Object.getOwnPropertyDescriptor(
      MarkdownController.prototype,
      'render',
    )?.value;

    expect(Reflect.getMetadata(GUARDS_METADATA, handler as object)).toEqual([
      JwtAuthGuard,
    ]);
  });
});
