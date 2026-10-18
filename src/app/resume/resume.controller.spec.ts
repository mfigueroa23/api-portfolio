import { HttpStatus, RequestMethod } from '@nestjs/common';
import {
  GUARDS_METADATA,
  HTTP_CODE_METADATA,
  METHOD_METADATA,
  PATH_METADATA,
} from '@nestjs/common/constants.js';
import type { Response } from 'express';
import { JwtAuthGuard } from '../auth/guards/jwt-auth.guard.js';
import { resumeHeaders } from '../files/files-response.js';
import { ResumeController } from './resume.controller.js';
import { ResumeService } from './resume.service.js';

// Nest stores route metadata on the method function itself.
function metadataOf(key: string, method: keyof ResumeController): unknown {
  const handler: unknown = Object.getOwnPropertyDescriptor(
    ResumeController.prototype,
    method,
  )?.value;
  return Reflect.getMetadata(key, handler as object);
}

describe('ResumeController', () => {
  const service = {
    assignments: vi.fn(),
    assign: vi.fn(),
    clear: vi.fn(),
    publicFile: vi.fn(),
  };
  const controller = new ResumeController(service as unknown as ResumeService);
  const fileId = '2b1e0a4c-5d3f-4e2a-9b8c-7d6e5f4a3b2c';
  const assignments = { en: null, es: null };

  beforeEach(() => {
    Object.values(service).forEach((fn) => fn.mockReset());
  });

  it('serves /resume publicly and the assignment routes to the owner only', () => {
    expect(Reflect.getMetadata(PATH_METADATA, ResumeController)).toBe('resume');
    expect(metadataOf(GUARDS_METADATA, 'download')).toBeUndefined();
    for (const [method, verb, path] of [
      ['assignments', RequestMethod.GET, 'assignments'],
      ['assign', RequestMethod.PUT, 'assignments/:lang'],
      ['clear', RequestMethod.DELETE, 'assignments/:lang'],
    ] as const) {
      expect(metadataOf(GUARDS_METADATA, method)).toEqual([JwtAuthGuard]);
      expect(metadataOf(METHOD_METADATA, method)).toBe(verb);
      expect(metadataOf(PATH_METADATA, method)).toBe(path);
    }
    expect(metadataOf(HTTP_CODE_METADATA, 'clear')).toBe(HttpStatus.NO_CONTENT);
  });

  it('sends the current PDF with the resume headers', async () => {
    const file = {
      data: Buffer.from('%PDF-1.7'),
      mime: 'application/pdf',
      name: 'CV.pdf',
    };
    service.publicFile.mockResolvedValue(file);
    const res = { set: vi.fn().mockReturnThis(), send: vi.fn() };

    await controller.download({ lang: 'es' }, res as unknown as Response);
    await controller.download({}, res as unknown as Response);

    expect(service.publicFile.mock.calls).toEqual([['es'], [undefined]]);
    expect(res.set).toHaveBeenCalledWith(resumeHeaders(file));
    expect(res.send).toHaveBeenCalledWith(file.data);
  });

  it('reads the assignments', async () => {
    service.assignments.mockResolvedValue(assignments);

    await expect(controller.assignments()).resolves.toBe(assignments);
  });

  it('assigns the file to the language in the path', async () => {
    service.assign.mockResolvedValue(assignments);

    await expect(controller.assign({ lang: 'en' }, { fileId })).resolves.toBe(
      assignments,
    );
    expect(service.assign).toHaveBeenCalledWith('en', fileId);
  });

  it('clears the language in the path', async () => {
    service.clear.mockResolvedValue(undefined);

    await expect(controller.clear({ lang: 'es' })).resolves.toBeUndefined();
    expect(service.clear).toHaveBeenCalledWith('es');
  });
});
