import { plainToInstance } from 'class-transformer';
import { validate } from 'class-validator';
import { LangQueryDto, langOf } from './lang.js';

describe('LangQueryDto', () => {
  it.each([
    [{ lang: 'es' }, 'es'],
    [{ lang: 'en' }, 'en'],
    [{ lang: 'fr' }, 'en'],
    [{ lang: 'ES' }, 'en'],
    [{ lang: ['es', 'en'] }, 'en'],
    [{}, 'en'],
  ])('reads %j as %s without failing validation', async (query, lang) => {
    const dto = plainToInstance(LangQueryDto, query);

    expect(await validate(dto, { whitelist: true })).toEqual([]);
    expect(langOf(dto)).toBe(lang);
  });
});
