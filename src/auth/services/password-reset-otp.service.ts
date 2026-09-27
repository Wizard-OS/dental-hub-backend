import { Injectable } from '@nestjs/common';
import { randomInt } from 'crypto';

import { getEnv } from '../../config/env';

@Injectable()
export class PasswordResetOtpService {
  static readonly ttlMs = 10 * 60 * 1000;
  static readonly maxAttempts = 5;
  static readonly lockMs = 15 * 60 * 1000;

  generate(): string {
    return randomInt(0, 1000000).toString().padStart(6, '0');
  }

  expirationFrom(now = Date.now()): Date {
    return new Date(now + PasswordResetOtpService.ttlMs);
  }

  shouldExposeDevOtp(): boolean {
    return (
      getEnv('NODE_ENV') === 'development' &&
      getEnv('ENABLE_DEV_OTP') === 'true'
    );
  }

  nextFailedAttemptState(currentAttemptCount: number | null | undefined) {
    const attemptCount = (currentAttemptCount ?? 0) + 1;

    return {
      passwordResetOtpAttemptCount: attemptCount,
      passwordResetOtpLockedUntil:
        attemptCount >= PasswordResetOtpService.maxAttempts
          ? new Date(Date.now() + PasswordResetOtpService.lockMs)
          : null,
    };
  }
}
