import { plainToInstance } from 'class-transformer';
import { validate } from 'class-validator';
import { ResumeLangParamDto, ResumeQueryDto } from './resume-lang.dto.js';

async function fieldsOf(
  type: typeof ResumeLangParamDto | typeof ResumeQueryDto,
  plain: Record<string, unknown>,
) {
  const errors = await validate(plainToInstance(type, plain), {
    whitelist: true,
  });
  return errors.map((error) => error.property);
}

describe.each([ResumeLangParamDto, ResumeQueryDto])('%o', (type) => {
  it.each(['en', 'es'])('accepts lang %s', async (lang) => {
    expect(await fieldsOf(type, { lang })).toEqual([]);
  });

  it.each([['fr'], [''], ['ES'], [['es', 'en']]])(
    'rejects lang %j with a lang error',
    async (lang) => {
      expect(await fieldsOf(type, { lang })).toEqual(['lang']);
    },
  );
});

describe('lang left out', () => {
  it('is an error in the path but allowed in the query', async () => {
    expect(await fieldsOf(ResumeLangParamDto, {})).toEqual(['lang']);
    expect(await fieldsOf(ResumeQueryDto, {})).toEqual([]);
  });
});
