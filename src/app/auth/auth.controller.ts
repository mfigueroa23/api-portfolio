import { Body, Controller, HttpCode, HttpStatus, Post } from '@nestjs/common';
import { AccessToken, AuthService } from './auth.service.js';
import { GoogleLoginDto } from './dto/google-login.dto.js';

@Controller('auth')
export class AuthController {
  constructor(private readonly auth: AuthService) {}

  // Rate-limited per IP by LoginRateLimitMiddleware (see AppModule).
  @Post('google')
  @HttpCode(HttpStatus.OK)
  loginWithGoogle(@Body() dto: GoogleLoginDto): Promise<AccessToken> {
    return this.auth.loginWithGoogle(dto);
  }
}
