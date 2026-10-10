import { apiMessage } from '../../common/i18n/api-message';
import { Injectable, ServiceUnavailableException } from '@nestjs/common';
import { getEnv, getRequiredEnv } from '../../config/env';

@Injectable()
export class MembershipEmailProvider {
  get configured() {
    return Boolean(getEnv('RESEND_API_KEY') && getEnv('MEMBERSHIP_EMAIL_FROM'));
  }
  async send(
    id: string,
    message: { to: string; subject: string; text: string },
  ) {
    if (!this.configured)
      throw new ServiceUnavailableException(
        apiMessage('api.messages.membership_email_is_not_configured'),
      );
    const response = await fetch('https://api.resend.com/emails', {
      method: 'POST',
      signal: AbortSignal.timeout(15000),
      headers: {
        Authorization: `Bearer ${getRequiredEnv('RESEND_API_KEY')}`,
        'Content-Type': 'application/json',
        'Idempotency-Key': id,
      },
      body: JSON.stringify({
        from: getRequiredEnv('MEMBERSHIP_EMAIL_FROM'),
        to: [message.to],
        subject: message.subject,
        text: message.text,
      }),
    });
    if (!response.ok)
      throw new ServiceUnavailableException(
        apiMessage('api.messages.membership_email_delivery_failed'),
      );
    const result = (await response.json()) as { id?: string };
    if (!result.id)
      throw new ServiceUnavailableException(
        apiMessage(
          'api.messages.email_provider_did_not_confirm_delivery_acceptance',
        ),
      );
    return result.id;
  }
}
