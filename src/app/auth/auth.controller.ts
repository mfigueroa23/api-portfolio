import { Body, Controller, HttpCode, HttpStatus, Post } from '@nestjs/common';
import { AccessToken, AuthService } from './auth.service.js';
import { LoginDto } from './dto/login.dto.js';

@Controller('auth')
export class AuthController {
  constructor(private readonly auth: AuthService) {}

  // Rate-limited per IP by LoginRateLimitMiddleware (see AppModule).
  @Post('login')
  @HttpCode(HttpStatus.OK)
  login(@Body() dto: LoginDto): Promise<AccessToken> {
    return this.auth.login(dto);
  }
}
