import { UnauthorizedException } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';

import { User } from '../entities/user.entity';
import { ValidRoles } from '../interfaces';
import { JwtStrategy } from './jwt.strategy';

describe('JwtStrategy', () => {
  const userId = 'a2b58f10-3456-4789-8123-012345678901';
  const sessionId = 'b2b58f10-3456-4789-8123-012345678901';
  let user: User;
  let lastActiveAt: Date;
  let userRepository: { findOneBy: jest.Mock };
  let userSessionsService: {
    assertActiveSession: jest.Mock;
    updateLastActive: jest.Mock;
  };
  let strategy: JwtStrategy;

  beforeEach(() => {
    user = {
      id: userId,
      email: 'doctor@dentalhub.test',
      password: null,
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
    };

    userRepository = {
      findOneBy: jest.fn(() => user),
    };
    lastActiveAt = new Date(Date.now() - 120_000);
    userSessionsService = {
      assertActiveSession: jest.fn().mockResolvedValue({ lastActiveAt }),
      updateLastActive: jest.fn(),
    };

    strategy = new JwtStrategy(
      userRepository as never,
      {
        get: jest.fn(() => 'test-jwt-secret-32-bytes-long-secure'),
      } as unknown as ConfigService,
      userSessionsService as never,
    );
  });

  it('validates an active session and exposes currentSessionId', async () => {
    await expect(strategy.validate({ id: userId, sessionId })).resolves.toBe(
      user,
    );

    expect(userSessionsService.assertActiveSession).toHaveBeenCalledWith(
      userId,
      sessionId,
    );
    expect(userSessionsService.updateLastActive).toHaveBeenCalledWith(
      sessionId,
      lastActiveAt,
    );
    expect(user.currentSessionId).toBe(sessionId);
  });

  it('rejects legacy tokens without sessionId', async () => {
    await expect(
      strategy.validate({ id: userId } as never),
    ).rejects.toBeInstanceOf(UnauthorizedException);
  });

  it('rejects revoked sessions', async () => {
    userSessionsService.assertActiveSession.mockRejectedValue(
      new UnauthorizedException('Session not valid'),
    );

    await expect(
      strategy.validate({ id: userId, sessionId }),
    ).rejects.toBeInstanceOf(UnauthorizedException);
  });
  it.each([
    null,
    {},
    { id: userId },
    { id: {}, sessionId },
    { id: userId, sessionId: 'invalid' },
  ])(
    'rejects malformed claims before querying persistence',
    async (payload) => {
      await expect(strategy.validate(payload as never)).rejects.toBeInstanceOf(
        UnauthorizedException,
      );
      expect(userRepository.findOneBy).not.toHaveBeenCalled();
    },
  );

  it('rejects inactive users before looking up sessions', async () => {
    user.isActive = false;
    await expect(
      strategy.validate({ id: userId, sessionId }),
    ).rejects.toBeInstanceOf(UnauthorizedException);
    expect(userSessionsService.assertActiveSession).not.toHaveBeenCalled();
  });
});
