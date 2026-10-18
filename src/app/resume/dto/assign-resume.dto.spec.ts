import { plainToInstance } from 'class-transformer';
import { validate } from 'class-validator';
import { AssignResumeDto } from './assign-resume.dto.js';

async function fieldsOf(plain: Record<string, unknown>) {
  const errors = await validate(plainToInstance(AssignResumeDto, plain), {
    whitelist: true,
  });
  return errors.map((error) => error.property);
}

describe('AssignResumeDto', () => {
  it('accepts a file UUID', async () => {
    expect(
      await fieldsOf({ fileId: '2b1e0a4c-5d3f-4e2a-9b8c-7d6e5f4a3b2c' }),
    ).toEqual([]);
  });

  it.each([[{}], [{ fileId: 'x' }], [{ fileId: 42 }], [{ fileId: '' }]])(
    'rejects %j with a fileId error',
    async (plain) => {
      expect(await fieldsOf(plain)).toEqual(['fileId']);
    },
  );
});
