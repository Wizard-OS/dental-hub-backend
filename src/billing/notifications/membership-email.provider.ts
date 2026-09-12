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
        'Membership email is not configured',
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
      throw new ServiceUnavailableException('Membership email delivery failed');
    const result = (await response.json()) as { id?: string };
    if (!result.id)
      throw new ServiceUnavailableException(
        'Email provider did not confirm delivery acceptance',
      );
    return result.id;
  }
}
