import {
  ArgumentsHost,
  Catch,
  ExceptionFilter,
  HttpException,
  HttpStatus,
  Logger,
} from '@nestjs/common';
import type { Request, Response } from 'express';
import { Prisma } from '../../../generated/prisma/client.js';
import { slugConflict, slugEsConflict } from '../../content/common/slug.js';
import { translate } from '../i18n/messages.js';
import { requestLang } from '../i18n/request-lang.js';

export interface ErrorBody {
  error: string;
  fields?: Record<string, string[]>;
}

// The public forms answer their messages in the page's language (RF-178).
const FORM_PATHS = ['/contact', '/testimonials'];

// P2002 names the column in meta.target with the classic engine and only the
// index (`<table>_<column>_key`) through the pg driver adapter.
function uniqueViolation(error: Prisma.PrismaClientKnownRequestError): {
  fields: unknown[];
  index: string;
} | null {
  if (error.code !== 'P2002') return null;
  const meta = (error.meta ?? {}) as {
    target?: unknown;
    driverAdapterError?: {
      cause?: { constraint?: { index?: unknown; fields?: unknown } };
    };
  };
  const constraint = meta.driverAdapterError?.cause?.constraint;
  return {
    fields: [meta.target, constraint?.fields].flat(),
    index: typeof constraint?.index === 'string' ? constraint.index : '',
  };
}

// The coalesce(slug_es, slug) expression index (Spec 004).
function isSlugEsConflict(
  error: Prisma.PrismaClientKnownRequestError,
): boolean {
  const violation = uniqueViolation(error);
  return (
    !!violation &&
    (violation.fields.includes('url_slug_es') ||
      violation.index.endsWith('_url_slug_es_key'))
  );
}

function isSlugConflict(error: Prisma.PrismaClientKnownRequestError): boolean {
  const violation = uniqueViolation(error);
  return (
    !!violation &&
    (violation.fields.includes('slug') || violation.index.endsWith('_slug_key'))
  );
}

// Every error leaves the API as { error, fields? }; anything unexpected is
// logged here and reaches the client only as a generic 500, never with a stack.
@Catch()
export class HttpExceptionFilter implements ExceptionFilter {
  private readonly logger = new Logger(HttpExceptionFilter.name);

  catch(exception: unknown, host: ArgumentsHost): void {
    const http = host.switchToHttp();
    const response = http.getResponse<Response>();
    const [status, body] = this.toErrorResponse(exception);
    response
      .status(status)
      .json(this.localize(http.getRequest<Request>(), body));
  }

  // Errors of the public forms (400, 429 from the middlewares, 500, 502) in
  // the language of the page they came from.
  private localize(request: Request, body: ErrorBody): ErrorBody {
    if (!FORM_PATHS.includes(request.path)) return body;
    return { ...body, error: translate(body.error, requestLang(request)) };
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
    // A Spanish URL slug taken between the service's check and the insert.
    if (
      exception instanceof Prisma.PrismaClientKnownRequestError &&
      isSlugEsConflict(exception)
    ) {
      const conflict = slugEsConflict();
      return [conflict.getStatus(), this.fromHttpException(conflict)];
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
