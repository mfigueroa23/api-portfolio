import {
  CallHandler,
  ExecutionContext,
  Injectable,
  NestInterceptor,
  SetMetadata,
} from '@nestjs/common';
import { Reflector } from '@nestjs/core';
import type { Request } from 'express';
import { Observable, of } from 'rxjs';
import { translate } from '../i18n/messages.js';
import { requestLang } from '../i18n/request-lang.js';

export const HONEYPOT_REPLY = 'honeypotReply';

// The success message a route answers to a filled honeypot: the same text as a
// real submission, so bots get no signal.
export const HoneypotReply = (message: string) =>
  SetMetadata(HONEYPOT_REPLY, message);

// Interceptors run before pipes, so a filled honeypot gets the normal success
// answer even when the other fields are invalid. Shared by every public form.
@Injectable()
export class HoneypotInterceptor implements NestInterceptor {
  constructor(private readonly reflector: Reflector) {}

  intercept(context: ExecutionContext, next: CallHandler): Observable<unknown> {
    const request = context.switchToHttp().getRequest<Request>();
    const body: unknown = request.body;
    const website =
      typeof body === 'object' && body !== null && !Array.isArray(body)
        ? (body as Record<string, unknown>).website
        : undefined;

    if (website !== undefined && website !== null && website !== '') {
      const message = this.reflector.get<string>(
        HONEYPOT_REPLY,
        context.getHandler(),
      );
      // In the page's language, like the real success answer.
      return of({ message: translate(message, requestLang(request)) });
    }
    return next.handle();
  }
}
