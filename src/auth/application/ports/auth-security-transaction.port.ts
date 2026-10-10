import type { SessionMetadata } from '../../../user-sessions/device-metadata.util';

export interface AuthSecurityAccount {
  id: string;
  email: string;
  isActive: boolean;
  password: string | null;
  passwordResetOtpHash: string | null;
  passwordResetOtpExpiresAt: Date | null;
  passwordResetOtpUsedAt: Date | null;
  passwordResetOtpAttemptCount: number;
  passwordResetOtpLockedUntil: Date | null;
}

export type AuthSecurityAccountUpdate = Partial<
  Pick<
    AuthSecurityAccount,
    | 'password'
    | 'passwordResetOtpHash'
    | 'passwordResetOtpExpiresAt'
    | 'passwordResetOtpUsedAt'
    | 'passwordResetOtpAttemptCount'
    | 'passwordResetOtpLockedUntil'
  >
>;

export interface LockedAuthSecurityAccount {
  account: AuthSecurityAccount;
  update(patch: AuthSecurityAccountUpdate): Promise<void>;
  createSession(metadata: SessionMetadata): Promise<string>;
  revokeSessions(exceptSessionId?: string): Promise<void>;
}

export interface AuthSecurityTransactionPort {
  withLockedAccountById<T>(
    userId: string,
    operation: (account: LockedAuthSecurityAccount | null) => Promise<T>,
  ): Promise<T>;
  withLockedAccountByEmail<T>(
    email: string,
    operation: (account: LockedAuthSecurityAccount | null) => Promise<T>,
  ): Promise<T>;
}

export const AUTH_SECURITY_TRANSACTION = Symbol('AUTH_SECURITY_TRANSACTION');
