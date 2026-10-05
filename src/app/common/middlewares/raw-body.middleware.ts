import { Injectable, NestMiddleware } from '@nestjs/common';
import type { NextFunction, Request, Response } from 'express';
import { JwtAuthGuard } from '../../auth/guards/jwt-auth.guard.js';

// The largest accepted upload (PDF); images have a lower limit checked later.
export const RAW_BODY_LIMIT_BYTES = 10 * 1024 * 1024;
// Left in req.body when the upload exceeds RAW_BODY_LIMIT_BYTES.
export const TOO_LARGE = Symbol('TOO_LARGE');

// Reads the raw request body of POST /files into a Buffer. The owner's token
// is checked first, so an anonymous upload is answered 401 without reading
// (or buffering) its body; the connection is then closed so the rest of the
// upload is not read either. An oversized authorized body is still drained
// (not buffered) so the service can answer 400 "File too large." instead of
// the connection being dropped mid-upload.
@Injectable()
export class RawBodyMiddleware implements NestMiddleware {
  constructor(private readonly auth: JwtAuthGuard) {}

  async use(req: Request, res: Response, next: NextFunction): Promise<void> {
    try {
      await this.auth.verify(req.headers.authorization);
    } catch (error) {
      res.setHeader('Connection', 'close');
      // Rethrown so the exception filter answers it like the guard would.
      throw error;
    }

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
