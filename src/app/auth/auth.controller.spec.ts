import { Test } from '@nestjs/testing';
import { AuthController } from './auth.controller.js';
import { AuthService } from './auth.service.js';

describe('AuthController', () => {
  const login = vi.fn();
  let controller: AuthController;

  beforeEach(async () => {
    login.mockReset();
    const moduleRef = await Test.createTestingModule({
      controllers: [AuthController],
      providers: [{ provide: AuthService, useValue: { login } }],
    }).compile();
    controller = moduleRef.get(AuthController);
  });

  it('returns the access token and its lifetime', async () => {
    login.mockResolvedValue({ accessToken: 'token', expiresIn: 3600 });

    await expect(
      controller.login({ username: 'marco', password: 's3cret' }),
    ).resolves.toEqual({ accessToken: 'token', expiresIn: 3600 });
    expect(login).toHaveBeenCalledWith({
      username: 'marco',
      password: 's3cret',
    });
  });
});
