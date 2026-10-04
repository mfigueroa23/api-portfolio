import { Test } from '@nestjs/testing';
import { AuthController } from './auth.controller.js';
import { AuthService } from './auth.service.js';

describe('AuthController', () => {
  const loginWithGoogle = vi.fn();
  let controller: AuthController;

  beforeEach(async () => {
    loginWithGoogle.mockReset();
    const moduleRef = await Test.createTestingModule({
      controllers: [AuthController],
      providers: [{ provide: AuthService, useValue: { loginWithGoogle } }],
    }).compile();
    controller = moduleRef.get(AuthController);
  });

  it('delegates the Google credential and returns the access token', async () => {
    loginWithGoogle.mockResolvedValue({
      accessToken: 'token',
      expiresIn: 3600,
    });

    await expect(
      controller.loginWithGoogle({ credential: 'google-id-token' }),
    ).resolves.toEqual({ accessToken: 'token', expiresIn: 3600 });
    expect(loginWithGoogle).toHaveBeenCalledWith({
      credential: 'google-id-token',
    });
  });
});
