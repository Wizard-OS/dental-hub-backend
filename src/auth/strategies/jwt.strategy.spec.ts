import { UnauthorizedException } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';

import { JwtStrategy } from './jwt.strategy';
import { User } from '../entities/user.entity';
import { ValidRoles } from '../interfaces';

describe('JwtStrategy', () => {
  const userId = 'user-1';
  const sessionId = 'session-1';
  let user: User;
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
    userSessionsService = {
      assertActiveSession: jest.fn(),
      updateLastActive: jest.fn(),
    };

    strategy = new JwtStrategy(
      userRepository as never,
      { get: jest.fn(() => 'test-secret') } as unknown as ConfigService,
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
});
