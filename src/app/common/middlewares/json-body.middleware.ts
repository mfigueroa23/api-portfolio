import { Injectable, NestMiddleware } from '@nestjs/common';
import type { NextFunction, Request, Response } from 'express';

const DEFAULT_LIMIT_BYTES = 16 * 1024;
// Routes that carry a Markdown body of up to 100,000 characters (up to 4 bytes
// each in UTF-8) plus the other fields of the item.
const LARGE_LIMIT_BYTES = 512 * 1024;
const LARGE_BODY_ROUTES = [
  '/content/projects',
  '/content/experiences',
  '/content/posts',
  '/markdown/render',
];

export function jsonLimitFor(url: string): number {
  const path = url.split('?')[0];
  const large = LARGE_BODY_ROUTES.some(
    (route) => path === route || path.startsWith(`${route}/`),
  );
  return large ? LARGE_LIMIT_BYTES : DEFAULT_LIMIT_BYTES;
}

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
    // A body already read (e.g. by RawBodyMiddleware) has no stream left.
    if (!isJsonRequest(req) || req.body !== undefined) {
      next();
      return;
    }
    const limit = jsonLimitFor(req.originalUrl ?? req.url);

    const chunks: Buffer[] = [];
    let size = 0;
    req.on('data', (chunk: Buffer) => {
      size += chunk.length;
      // Keep draining the stream so the response can still be sent, but stop
      // buffering once the limit is exceeded.
      if (size <= limit) chunks.push(chunk);
    });
    req.on('end', () => {
      req.body = size <= limit ? parseJson(Buffer.concat(chunks)) : undefined;
      next();
    });
    req.on('error', () => {
      req.body = undefined;
      next();
    });
  }
}
