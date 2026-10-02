import { Injectable, NestMiddleware } from '@nestjs/common';
import type { NextFunction, Request, Response } from 'express';

const LIMIT_BYTES = 16 * 1024;

function isJsonRequest(req: Request): boolean {
  const contentType = req.headers['content-type'] ?? '';
  return contentType.split(';')[0].trim().toLowerCase() === 'application/json';
}

// Only objects and arrays are accepted, like express.json's strict mode.
function parseJson(raw: Buffer): unknown {
  try {
    const value: unknown = JSON.parse(raw.toString('utf8'));
    return typeof value === 'object' && value !== null ? value : undefined;
  } catch {
    return undefined;
  }
}

// Replaces Nest's global body parser (disabled in main.ts) so it can run after
// the rate-limit middlewares: a malformed, oversized or non-object body is left
// undefined instead of failing here, so it still counts toward the limit and
// each route's validation answers with its own 400.
@Injectable()
export class JsonBodyMiddleware implements NestMiddleware {
  use(req: Request, _res: Response, next: NextFunction): void {
    if (!isJsonRequest(req)) {
      next();
      return;
    }

    const chunks: Buffer[] = [];
    let size = 0;
    req.on('data', (chunk: Buffer) => {
      size += chunk.length;
      // Keep draining the stream so the response can still be sent, but stop
      // buffering once the limit is exceeded.
      if (size <= LIMIT_BYTES) chunks.push(chunk);
    });
    req.on('end', () => {
      req.body =
        size <= LIMIT_BYTES ? parseJson(Buffer.concat(chunks)) : undefined;
      next();
    });
    req.on('error', () => {
      req.body = undefined;
      next();
    });
  }
}
