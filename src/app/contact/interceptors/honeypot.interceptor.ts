import {
  CallHandler,
  ExecutionContext,
  Injectable,
  NestInterceptor,
} from '@nestjs/common';
import type { Request } from 'express';
import { Observable, of } from 'rxjs';
import { CONTACT_SUCCESS_MESSAGE } from '../contact.constants.js';

// Interceptors run before pipes, so a filled honeypot gets the normal success
// answer even when the other fields are invalid: bots get no signal.
@Injectable()
export class HoneypotInterceptor implements NestInterceptor {
  intercept(context: ExecutionContext, next: CallHandler): Observable<unknown> {
    const body: unknown = context.switchToHttp().getRequest<Request>().body;
    const website =
      typeof body === 'object' && body !== null && !Array.isArray(body)
        ? (body as Record<string, unknown>).website
        : undefined;

    if (website !== undefined && website !== null && website !== '') {
      return of({ message: CONTACT_SUCCESS_MESSAGE });
    }
    return next.handle();
  }
}
