import { Injectable } from '@nestjs/common';
import { OAuth2Client } from 'google-auth-library';

import { GoogleIdentityVerifier } from '../application/google-identity-verifier';
import { PersonalDriveError } from '../domain/personal-drive';

@Injectable()
export class GoogleTokenVerifier implements GoogleIdentityVerifier {
  private readonly client = new OAuth2Client();

  async verify(idToken: string) {
    const audience = process.env.GOOGLE_DRIVE_CLIENT_ID;
    if (!audience) {
      throw new PersonalDriveError(
        'GOOGLE_NOT_CONFIGURED',
        'Google Drive is not configured.',
      );
    }

    const ticket = await this.client
      .verifyIdToken({ idToken, audience })
      .catch(() => {
        throw new PersonalDriveError(
          'INVALID_GOOGLE_TOKEN',
          'Google Drive authorization could not be verified. Reconnect Drive.',
        );
      });

    const payload = ticket.getPayload();
    if (!payload?.sub || !payload.email || !payload.email_verified) {
      throw new PersonalDriveError(
        'INVALID_GOOGLE_TOKEN',
        'Google Drive authorization could not be verified. Reconnect Drive.',
      );
    }

    return {
      subject: payload.sub,
      email: payload.email.toLowerCase().trim(),
    };
  }
}
