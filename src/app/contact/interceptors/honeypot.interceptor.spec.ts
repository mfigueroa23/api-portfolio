import { CallHandler, ExecutionContext } from '@nestjs/common';
import { lastValueFrom, of } from 'rxjs';
import { CONTACT_SUCCESS_MESSAGE } from '../contact.constants.js';
import { HoneypotInterceptor } from './honeypot.interceptor.js';

function contextWithBody(body: unknown): ExecutionContext {
  return {
    switchToHttp: () => ({ getRequest: () => ({ body }) }),
  } as unknown as ExecutionContext;
}

describe('HoneypotInterceptor', () => {
  const interceptor = new HoneypotInterceptor();
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
