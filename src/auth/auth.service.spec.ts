import { BadRequestException, UnauthorizedException } from '@nestjs/common';
import * as bcrypt from 'bcrypt';

import { AuthService } from './auth.service';
import { apiMessage } from '../common/i18n/api-message';
import { User } from './entities/user.entity';
import { UserSession } from '../user-sessions/entities/user-session.entity';
import { ValidRoles } from './interfaces';
import { PasswordHasherService } from './services/password-hasher.service';
import { PasswordResetOtpService } from './services/password-reset-otp.service';
import type { LockedAuthSecurityAccount } from './application/ports/auth-security-transaction.port';

describe('AuthService password reset', () => {
  let service: AuthService;
  let users: Map<string, User>;
  let specialties: Map<string, { id: string; isActive: boolean }>;
  let jwtService: { sign: jest.Mock };
  let activeSessions: UserSession[];
  let userSessionsService: {
    createSession: jest.Mock;
    revokeCurrentSession: jest.Mock;
  };

  const userId = 'user-1';
  const email = 'doctor@dentalhub.test';
  const originalNodeEnv = process.env.NODE_ENV;
  const originalEnableDevOtp = process.env.ENABLE_DEV_OTP;

  beforeEach(() => {
    process.env.NODE_ENV = 'development';
    process.env.ENABLE_DEV_OTP = 'true';
    users = new Map<string, User>();
    activeSessions = [];
    specialties = new Map<string, { id: string; isActive: boolean }>();
    specialties.set('specialty-1', { id: 'specialty-1', isActive: true });
    users.set(userId, {
      id: userId,
      email,
      password: bcrypt.hashSync('OldPass1', 10),
      googleSubject: null,
      googleEmail: null,
      firstName: 'Ana',
      lastName: 'Silva',
      isActive: true,
      roles: [ValidRoles.odontologist],
      appointments: [],
      clinicalNotes: [],
      memberships: [],
      passwordResetOtpAttemptCount: 0,
      createdAt: new Date(),
      updatedAt: new Date(),
      checkFieldsBeforeInsert: jest.fn(),
      checkFieldsBeforeUpdate: jest.fn(),
    });

    const userRepository = {
      findOne: jest.fn(
        ({ where }: { where: { id?: string; email?: string } }) => {
          if (where.id) return users.get(where.id) ?? null;
          if (where.email) {
            return (
              [...users.values()].find((user) => user.email === where.email) ??
              null
            );
          }
          return null;
        },
      ),
      update: jest.fn((id: string, patch: Partial<User>) => {
        const user = users.get(id);
        if (!user) return { affected: 0 };
        Object.assign(user, patch);
        return { affected: 1 };
      }),
    };

    let transactionTail = Promise.resolve();
    const transactAccount = async <T>(
      account: User | undefined,
      operation: (
        lockedAccount: LockedAuthSecurityAccount | null,
      ) => Promise<T>,
    ) => {
      const previous = transactionTail;
      let release: () => void = () => undefined;
      transactionTail = new Promise<void>((resolve) => {
        release = resolve;
      });
      await previous;
      try {
        if (!account) return operation(null);
        const securityAccount = {
          id: account.id,
          email: account.email,
          isActive: account.isActive,
          password: account.password,
          passwordResetOtpHash: account.passwordResetOtpHash ?? null,
          passwordResetOtpExpiresAt: account.passwordResetOtpExpiresAt ?? null,
          passwordResetOtpUsedAt: account.passwordResetOtpUsedAt ?? null,
          passwordResetOtpAttemptCount:
            account.passwordResetOtpAttemptCount ?? 0,
          passwordResetOtpLockedUntil:
            account.passwordResetOtpLockedUntil ?? null,
        };
        return await operation({
          account: securityAccount,
          update: (patch) => {
            Object.assign(account, patch);
            Object.assign(securityAccount, patch);
            return Promise.resolve();
          },
          createSession: (metadata) => {
            const id = `session-${userId}`;
            activeSessions.push({
              id,
              userId,
              ...metadata,
              isRevoked: false,
              revokedAt: null,
            } as UserSession);
            return Promise.resolve(id);
          },
          revokeSessions: (exceptSessionId) => {
            activeSessions.forEach((session) => {
              if (
                session.userId === account.id &&
                session.id !== exceptSessionId
              ) {
                session.isRevoked = true;
                session.revokedAt = new Date();
              }
            });
            return Promise.resolve();
          },
        });
      } finally {
        release();
      }
    };
    const securityTransactions = {
      withLockedAccountById: (
        id: string,
        operation: (
          account: LockedAuthSecurityAccount | null,
        ) => Promise<unknown>,
      ) => transactAccount(users.get(id), operation),
      withLockedAccountByEmail: (
        lookupEmail: string,
        operation: (
          account: LockedAuthSecurityAccount | null,
        ) => Promise<unknown>,
      ) =>
        transactAccount(
          [...users.values()].find(
            (candidate) => candidate.email === lookupEmail.toLowerCase().trim(),
          ),
          operation,
        ),
    };

    const clinicMembershipRepository = {
      find: jest.fn(() => []),
    };

    const specialtyRepository = {
      findOne: jest.fn(
        ({ where }: { where: { id?: string; isActive?: boolean } }) => {
          if (!where.id) return null;
          const specialty = specialties.get(where.id);
          if (!specialty) return null;
          if (
            where.isActive !== undefined &&
            specialty.isActive !== where.isActive
          ) {
            return null;
          }
          return specialty;
        },
      ),
    };

    jwtService = {
      sign: jest.fn(() => 'jwt-token'),
    };

    userSessionsService = {
      createSession: jest.fn((createdUserId: string) => ({
        id: `session-${createdUserId}`,
      })),
      revokeCurrentSession: jest.fn().mockResolvedValue({
        message: 'Logged out successfully',
      }),
    };

    service = new AuthService(
      userRepository as never,
      clinicMembershipRepository as never,
      specialtyRepository as never,
      jwtService as never,
      userSessionsService as never,
      new PasswordHasherService(),
      new PasswordResetOtpService(),
      { configured: false, sendCode: jest.fn() },
      securityTransactions as never,
    );
  });

  afterEach(() => {
    if (originalNodeEnv === undefined) delete process.env.NODE_ENV;
    else process.env.NODE_ENV = originalNodeEnv;
    if (originalEnableDevOtp === undefined) delete process.env.ENABLE_DEV_OTP;
    else process.env.ENABLE_DEV_OTP = originalEnableDevOtp;
  });

  it('returns a generic response when requesting reset for an unknown email', async () => {
    await expect(
      service.forgotPassword({ email: 'missing@dentalhub.test' }),
    ).resolves.toEqual({
      message: apiMessage(
        'api.messages.if_the_email_exists_a_password_reset_code_has_been_sent',
      ),
    });
  });

  it('verifies a valid OTP without changing the password', async () => {
    const response = await service.forgotPassword({ email });
    const otp = response.devOtp;

    expect(otp).toMatch(/^\d{6}$/);
    await expect(service.verifyOtp({ email, otp: otp! })).resolves.toEqual({
      message: apiMessage('api.messages.otp_verified_successfully'),
    });
    await expect(
      service.login({ email, password: 'OldPass1' }),
    ).resolves.toMatchObject({ email, token: 'jwt-token' });
    expect(jwtService.sign).toHaveBeenLastCalledWith({
      id: userId,
      sessionId: `session-${userId}`,
    });
  });

  it('resets password, invalidates OTP, and rejects the old password', async () => {
    const response = await service.forgotPassword({ email });
    const otp = response.devOtp!;
    activeSessions.push(
      { id: 'old-a', userId, isRevoked: false, revokedAt: null } as UserSession,
      { id: 'old-b', userId, isRevoked: false, revokedAt: null } as UserSession,
    );

    await expect(
      service.resetPassword({ email, otp, newPassword: 'NewPass1' }),
    ).resolves.toEqual({
      message: apiMessage('api.messages.password_reset_successfully'),
    });
    expect(activeSessions.every((session) => session.isRevoked)).toBe(true);

    await expect(service.verifyOtp({ email, otp })).rejects.toBeInstanceOf(
      BadRequestException,
    );
    await expect(
      service.login({ email, password: 'OldPass1' }),
    ).rejects.toBeInstanceOf(UnauthorizedException);
    await expect(
      service.login({ email, password: 'NewPass1' }),
    ).resolves.toMatchObject({ email, token: 'jwt-token' });
  });

  it('lets a Google-only account establish a password through recovery', async () => {
    users.get(userId)!.password = null;
    const response = await service.forgotPassword({ email });
    const otp = response.devOtp!;

    await expect(
      service.resetPassword({ email, otp, newPassword: 'NewPass1' }),
    ).resolves.toEqual({
      message: apiMessage('api.messages.password_reset_successfully'),
    });
    await expect(
      service.login({ email, password: 'NewPass1' }),
    ).resolves.toMatchObject({ email, token: 'jwt-token' });
  });

  it('rejects expired OTP codes', async () => {
    const response = await service.forgotPassword({ email });
    const user = users.get(userId)!;
    user.passwordResetOtpExpiresAt = new Date(Date.now() - 1000);

    await expect(
      service.verifyOtp({ email, otp: response.devOtp! }),
    ).rejects.toBeInstanceOf(BadRequestException);
  });

  it('locks OTP verification after repeated invalid attempts', async () => {
    const response = await service.forgotPassword({ email });
    const user = users.get(userId)!;

    for (let attempt = 0; attempt < 5; attempt += 1) {
      await expect(
        service.verifyOtp({ email, otp: '000000' }),
      ).rejects.toBeInstanceOf(BadRequestException);
    }

    expect(user.passwordResetOtpAttemptCount).toBe(5);
    expect(user.passwordResetOtpLockedUntil).toBeInstanceOf(Date);
    await expect(
      service.verifyOtp({ email, otp: response.devOtp! }),
    ).rejects.toBeInstanceOf(BadRequestException);
  });

  it('serializes concurrent OTP failures and prevents resends from clearing a lock', async () => {
    await service.forgotPassword({ email });
    await Promise.all(
      Array.from({ length: 8 }, () =>
        service.verifyOtp({ email, otp: '999999' }).catch(() => undefined),
      ),
    );

    const user = users.get(userId)!;
    expect(user.passwordResetOtpAttemptCount).toBe(5);
    expect(user.passwordResetOtpLockedUntil).toBeInstanceOf(Date);
    await service.forgotPassword({ email });
    expect(user.passwordResetOtpAttemptCount).toBe(5);
    expect(user.passwordResetOtpLockedUntil).toBeInstanceOf(Date);
  });

  it('consumes a reset OTP once when reset requests race', async () => {
    const response = await service.forgotPassword({ email });
    const results = await Promise.allSettled([
      service.resetPassword({
        email,
        otp: response.devOtp!,
        newPassword: 'FirstPass1',
      }),
      service.resetPassword({
        email,
        otp: response.devOtp!,
        newPassword: 'SecondPass1',
      }),
    ]);

    expect(
      results.filter((result) => result.status === 'fulfilled'),
    ).toHaveLength(1);
  });

  it('does not leave an old-password login session active when reset races login', async () => {
    const response = await service.forgotPassword({ email });
    const login = service.login({ email, password: 'OldPass1' });
    const reset = service.resetPassword({
      email,
      otp: response.devOtp!,
      newPassword: 'NewPass1',
    });

    const [loginResult] = await Promise.allSettled([login, reset]);
    if (loginResult.status === 'fulfilled') {
      expect(
        activeSessions
          .filter((session) => session.userId === userId)
          .every((session) => session.isRevoked),
      ).toBe(true);
    } else {
      expect(loginResult.reason).toBeInstanceOf(UnauthorizedException);
    }
    await expect(
      service.login({ email, password: 'OldPass1' }),
    ).rejects.toBeInstanceOf(UnauthorizedException);
  });

  it('keeps the current session and revokes other sessions on password change', async () => {
    const user = users.get(userId)!;
    user.currentSessionId = 'current-session';
    activeSessions.push(
      {
        id: 'current-session',
        userId,
        isRevoked: false,
        revokedAt: null,
      } as UserSession,
      {
        id: 'other-session',
        userId,
        isRevoked: false,
        revokedAt: null,
      } as UserSession,
    );

    await expect(
      service.changePassword(user, {
        currentPassword: 'OldPass1',
        newPassword: 'NewPass1',
      }),
    ).resolves.toMatchObject({
      message: apiMessage('api.messages.password_changed_successfully'),
    });
    expect(
      activeSessions.find(({ id }) => id === 'current-session')?.isRevoked,
    ).toBe(false);
    expect(
      activeSessions.find(({ id }) => id === 'other-session')?.isRevoked,
    ).toBe(true);
  });

  it('does not expose dev OTP unless explicitly enabled in local development', async () => {
    process.env.ENABLE_DEV_OTP = 'false';

    await expect(service.forgotPassword({ email })).resolves.toEqual({
      message: apiMessage(
        'api.messages.if_the_email_exists_a_password_reset_code_has_been_sent',
      ),
    });
  });

  it('updates extended profile fields', async () => {
    await expect(
      service.updateProfile(users.get(userId)!, {
        phone: '+598 95 123 456',
        birthDate: '1988-05-12T00:00:00.000Z',
        professionalLicenseNumber: 'CJPPU-12345',
        professionalSpecialtyId: 'specialty-1',
        rut: '210000000018',
      }),
    ).rejects.toBeInstanceOf(UnauthorizedException);

    const authenticatedUser = users.get(userId)!;
    authenticatedUser.currentSessionId = 'session-current';

    await expect(
      service.updateProfile(authenticatedUser, {
        phone: '+598 95 123 456',
        birthDate: '1988-05-12T00:00:00.000Z',
        professionalLicenseNumber: 'CJPPU-12345',
        professionalSpecialtyId: 'specialty-1',
        rut: '210000000018',
      }),
    ).resolves.toMatchObject({
      phone: '+598 95 123 456',
      professionalLicenseNumber: 'CJPPU-12345',
      professionalSpecialtyId: 'specialty-1',
      rut: '210000000018',
      token: 'jwt-token',
    });

    expect(authenticatedUser.birthDate).toEqual(
      new Date('1988-05-12T00:00:00.000Z'),
    );
  });

  it('rejects inactive or unknown professional specialties', async () => {
    specialties.set('inactive-specialty', {
      id: 'inactive-specialty',
      isActive: false,
    });

    await expect(
      service.updateProfile(users.get(userId)!, {
        professionalSpecialtyId: 'inactive-specialty',
      }),
    ).rejects.toBeInstanceOf(BadRequestException);
  });

  it('logs out by revoking the current session', async () => {
    const user = users.get(userId)!;
    user.currentSessionId = 'session-current';

    await expect(service.logout(user)).resolves.toEqual({
      message: 'Logged out successfully',
    });
    expect(userSessionsService.revokeCurrentSession).toHaveBeenCalledWith(
      userId,
      'session-current',
    );
  });
});
