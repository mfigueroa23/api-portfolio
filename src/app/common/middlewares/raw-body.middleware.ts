import { Injectable, NestMiddleware } from '@nestjs/common';
import type { NextFunction, Request, Response } from 'express';

// The largest accepted upload (PDF); images have a lower limit checked later.
export const RAW_BODY_LIMIT_BYTES = 10 * 1024 * 1024;
// Left in req.body when the upload exceeds RAW_BODY_LIMIT_BYTES.
export const TOO_LARGE = Symbol('TOO_LARGE');

// Reads the raw request body of POST /files into a Buffer. An oversized body
// is still drained (not buffered) so the service can answer 400 "File too
// large." instead of the connection being dropped mid-upload.
@Injectable()
export class RawBodyMiddleware implements NestMiddleware {
  use(req: Request, _res: Response, next: NextFunction): void {
    const chunks: Buffer[] = [];
    let size = 0;
    req.on('data', (chunk: Buffer) => {
      size += chunk.length;
      if (size <= RAW_BODY_LIMIT_BYTES) chunks.push(chunk);
    });
    req.on('end', () => {
      req.body =
        size <= RAW_BODY_LIMIT_BYTES ? Buffer.concat(chunks) : TOO_LARGE;
      next();
    });
    req.on('error', () => {
      req.body = TOO_LARGE;
      next();
    });
  }
}
