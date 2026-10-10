import { apiMessage } from '../../common/i18n/api-message';
import { Injectable, ServiceUnavailableException } from '@nestjs/common';
import { randomUUID } from 'crypto';

import { getEnv, getRequiredEnv } from '../../config/env';

@Injectable()
export class PasswordResetEmailProvider {
  get configured() {
    return Boolean(
      getEnv('RESEND_API_KEY') &&
      (getEnv('AUTH_EMAIL_FROM') || getEnv('MEMBERSHIP_EMAIL_FROM')),
    );
  }

  async sendCode(to: string, code: string): Promise<void> {
    if (!this.configured) {
      throw new ServiceUnavailableException(
        apiMessage('api.messages.password_reset_email_is_not_configured'),
      );
    }

    const response = await fetch('https://api.resend.com/emails', {
      method: 'POST',
      signal: AbortSignal.timeout(15000),
      headers: {
        Authorization: `Bearer ${getRequiredEnv('RESEND_API_KEY')}`,
        'Content-Type': 'application/json',
        'Idempotency-Key': randomUUID(),
      },
      body: JSON.stringify({
        from:
          getEnv('AUTH_EMAIL_FROM') ?? getRequiredEnv('MEMBERSHIP_EMAIL_FROM'),
        to: [to],
        subject: 'Your DentalHub password reset code',
        text: `Your DentalHub password reset code is ${code}. It expires in 10 minutes. If you did not request this, ignore this email.`,
      }),
    }).catch(() => {
      throw new ServiceUnavailableException(
        apiMessage('api.messages.password_reset_email_delivery_failed'),
      );
    });

    if (!response.ok) {
      throw new ServiceUnavailableException(
        apiMessage('api.messages.password_reset_email_delivery_failed'),
      );
    }
  }
}
