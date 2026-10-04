import { Injectable } from '@nestjs/common';
import { OAuth2Client } from 'google-auth-library';
import { GoogleIdentity } from '../interfaces/google-identity.interface.js';

// Verifies Google ID tokens with Google's official library, which checks the
// signature against Google's rotating keys plus `iss`, `aud` and `exp`.
// Every failure collapses to null so the caller answers one generic 401, and
// nothing is logged here because the token is a credential.
@Injectable()
export class GoogleIdTokenClient {
  private readonly client = new OAuth2Client();

  async verify(
    idToken: string,
    clientId: string,
  ): Promise<GoogleIdentity | null> {
    try {
      const ticket = await this.client.verifyIdToken({
        idToken,
        audience: clientId,
      });
      const payload = ticket.getPayload();
      if (!payload?.email) return null;
      return {
        email: payload.email,
        emailVerified: payload.email_verified === true,
      };
    } catch {
      return null;
    }
  }
}
