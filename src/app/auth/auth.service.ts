import {
  ForbiddenException,
  Injectable,
  InternalServerErrorException,
  Logger,
  UnauthorizedException,
} from '@nestjs/common';
import { JwtService } from '@nestjs/jwt';
import { PropertiesService } from '../properties/properties.service.js';
import { GoogleIdTokenClient } from './clients/google-id-token.client.js';
import { GoogleLoginDto } from './dto/google-login.dto.js';
import { JwtPayload } from './interfaces/jwt-payload.interface.js';

export const TOKEN_LIFETIME_SECONDS = 3600;

export interface AccessToken {
  accessToken: string;
  expiresIn: number;
}

// Normalized so a stray space or a different case in the SQL-managed value
// does not lock the owner out.
function normalizeEmail(email: string): string {
  return email.trim().toLowerCase();
}

@Injectable()
export class AuthService {
  private readonly logger = new Logger(AuthService.name);

  constructor(
    private readonly properties: PropertiesService,
    private readonly google: GoogleIdTokenClient,
    private readonly jwt: JwtService,
  ) {}

  async loginWithGoogle({ credential }: GoogleLoginDto): Promise<AccessToken> {
    const clientId = await this.requireSignInProperty('google_client_id');
    const adminEmail = await this.requireSignInProperty('admin_google_email');

    const identity = await this.google.verify(credential, clientId);
    if (!identity) {
      throw new UnauthorizedException('Invalid Google sign-in.');
    }
    // An unverified address could belong to someone who merely typed it, so
    // only a verified match identifies the owner.
    if (
      !identity.emailVerified ||
      normalizeEmail(identity.email) !== normalizeEmail(adminEmail)
    ) {
      throw new ForbiddenException('This Google account is not authorized.');
    }

    const secret = await this.properties.get('jwt_secret');
    if (!secret) {
      this.logger.error('The jwt_secret property is not configured');
      throw new InternalServerErrorException('Internal server error.');
    }

    const payload: JwtPayload = { sub: 'owner' };
    const accessToken = await this.jwt.signAsync(payload, {
      secret,
      algorithm: 'HS256',
      expiresIn: TOKEN_LIFETIME_SECONDS,
    });
    return { accessToken, expiresIn: TOKEN_LIFETIME_SECONDS };
  }

  // The log names the missing key (never a value) so the owner knows which
  // SQL row to insert; the client only learns that sign-in is unavailable.
  private async requireSignInProperty(key: string): Promise<string> {
    const value = await this.properties.get(key);
    if (!value) {
      this.logger.error(`The ${key} property is not configured`);
      throw new InternalServerErrorException('Sign-in is not available.');
    }
    return value;
  }
}
