import { CallHandler, ExecutionContext } from '@nestjs/common';
import { Reflector } from '@nestjs/core';
import { lastValueFrom, of } from 'rxjs';
import { CONTACT_SUCCESS_MESSAGE } from '../../contact/contact.constants.js';
import { HoneypotInterceptor, HoneypotReply } from './honeypot.interceptor.js';

const TESTIMONIAL_MESSAGE =
  'Thanks! Your testimonial will appear once it has been reviewed.';

class Routes {
  @HoneypotReply(CONTACT_SUCCESS_MESSAGE)
  contact(): void {}

  @HoneypotReply(TESTIMONIAL_MESSAGE)
  testimonial(): void {}
}

// Nest stores the metadata on the method function itself.
const handlerOf = (route: keyof Routes): unknown =>
  Object.getOwnPropertyDescriptor(Routes.prototype, route)?.value;

function contextWithBody(
  body: unknown,
  route: keyof Routes = 'contact',
): ExecutionContext {
  return {
    getHandler: () => handlerOf(route),
    switchToHttp: () => ({ getRequest: () => ({ body }) }),
  } as unknown as ExecutionContext;
}

describe('HoneypotInterceptor', () => {
  const interceptor = new HoneypotInterceptor(new Reflector());
  const handle = vi.fn(() => of('handled'));
  const next: CallHandler = { handle };

  beforeEach(() => {
    handle.mockClear();
  });

  it.each(['http://spam.example', ' ', 0, false, ['x']])(
    'answers the success message without calling the handler when website is %j',
    async (website) => {
      const result = await lastValueFrom(
        interceptor.intercept(contextWithBody({ name: '', website }), next),
      );

      expect(result).toEqual({ message: CONTACT_SUCCESS_MESSAGE });
      expect(handle).not.toHaveBeenCalled();
    },
  );

  it('answers the message declared by each route', async () => {
    const result = await lastValueFrom(
      interceptor.intercept(
        contextWithBody({ website: 'bot' }, 'testimonial'),
        next,
      ),
    );

    expect(result).toEqual({ message: TESTIMONIAL_MESSAGE });
    expect(handle).not.toHaveBeenCalled();
  });

  it.each([
    ['empty', { name: 'Ada', website: '' }],
    ['null', { name: 'Ada', website: null }],
    ['missing', { name: 'Ada' }],
    ['an undefined body', undefined],
    ['an array body', [1, 2]],
  ])('calls the handler when website is %s', async (_label, body) => {
    const result = await lastValueFrom(
      interceptor.intercept(contextWithBody(body), next),
    );

    expect(result).toBe('handled');
    expect(handle).toHaveBeenCalledTimes(1);
  });
});
