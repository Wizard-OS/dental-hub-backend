import { Injectable } from '@nestjs/common';
import { OAuth2Client } from 'google-auth-library';
import { GoogleIdentityVerifier } from '../application/google-authentication';
import {
  GoogleAuthenticationError,
  GoogleIdentity,
} from '../domain/google-identity';

@Injectable()
export class GoogleTokenVerifier implements GoogleIdentityVerifier {
  private readonly client = new OAuth2Client();

  async verify(idToken: string): Promise<GoogleIdentity> {
    const audience = process.env.GOOGLE_DRIVE_CLIENT_ID;
    if (!audience)
      throw new GoogleAuthenticationError(
        'GOOGLE_NOT_CONFIGURED',
        'Google sign-in is not configured.',
      );
    const ticket = await this.client
      .verifyIdToken({ idToken, audience })
      .catch(() => {
        throw new GoogleAuthenticationError(
          'INVALID_GOOGLE_TOKEN',
          'Google sign-in expired or could not be verified. Please try again.',
        );
      });

    const payload = ticket.getPayload();
    if (!payload?.sub || !payload.email || !payload.email_verified)
      throw new GoogleAuthenticationError(
        'INVALID_GOOGLE_TOKEN',
        'Google sign-in expired or could not be verified. Please try again.',
      );

    return {
      subject: payload.sub,
      email: payload.email.toLowerCase().trim(),
      firstName: payload.given_name ?? payload.name ?? '',
      lastName: payload.family_name ?? '',
      photoUrl: payload.picture,
    };
  }
}
