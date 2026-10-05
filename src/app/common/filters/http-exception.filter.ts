import {
  ArgumentsHost,
  Catch,
  ExceptionFilter,
  HttpException,
  HttpStatus,
  Logger,
} from '@nestjs/common';
import type { Response } from 'express';
import { Prisma } from '../../../generated/prisma/client.js';
import { slugConflict } from '../../content/common/slug.js';

export interface ErrorBody {
  error: string;
  fields?: Record<string, string[]>;
}

// P2002 names the column in meta.target with the classic engine and only the
// index (`<table>_<column>_key`) through the pg driver adapter.
function isSlugConflict(error: Prisma.PrismaClientKnownRequestError): boolean {
  if (error.code !== 'P2002') return false;
  const meta = (error.meta ?? {}) as {
    target?: unknown;
    driverAdapterError?: {
      cause?: { constraint?: { index?: unknown; fields?: unknown } };
    };
  };
  const constraint = meta.driverAdapterError?.cause?.constraint;
  const fields = [meta.target, constraint?.fields].flat();
  return (
    fields.includes('slug') ||
    (typeof constraint?.index === 'string' &&
      constraint.index.endsWith('_slug_key'))
  );
}

// Every error leaves the API as { error, fields? }; anything unexpected is
// logged here and reaches the client only as a generic 500, never with a stack.
@Catch()
export class HttpExceptionFilter implements ExceptionFilter {
  private readonly logger = new Logger(HttpExceptionFilter.name);

  catch(exception: unknown, host: ArgumentsHost): void {
    const response = host.switchToHttp().getResponse<Response>();
    const [status, body] = this.toErrorResponse(exception);
    response.status(status).json(body);
  }

  private toErrorResponse(exception: unknown): [number, ErrorBody] {
    if (exception instanceof HttpException) {
      return [exception.getStatus(), this.fromHttpException(exception)];
    }
    // Updating or deleting a row that does not exist.
    if (
      exception instanceof Prisma.PrismaClientKnownRequestError &&
      exception.code === 'P2025'
    ) {
      return [HttpStatus.NOT_FOUND, { error: 'Not found.' }];
    }
    // A slug taken between the service's check and the insert.
    if (
      exception instanceof Prisma.PrismaClientKnownRequestError &&
      isSlugConflict(exception)
    ) {
      const conflict = slugConflict();
      return [conflict.getStatus(), this.fromHttpException(conflict)];
    }
    this.logger.error(exception);
    return [
      HttpStatus.INTERNAL_SERVER_ERROR,
      { error: 'Internal server error.' },
    ];
  }

  private fromHttpException(exception: HttpException): ErrorBody {
    const response = exception.getResponse();
    if (typeof response === 'string') {
      return { error: response };
    }
    const { message, error, fields } = response as {
      message?: unknown;
      error?: unknown;
      fields?: Record<string, string[]>;
    };
    // Nest's built-in exceptions carry the useful text in `message` (and a
    // generic status name in `error`); ours set `error` directly.
    const text =
      typeof message === 'string'
        ? message
        : typeof error === 'string'
          ? error
          : exception.message;
    return fields ? { error: text, fields } : { error: text };
  }
}
