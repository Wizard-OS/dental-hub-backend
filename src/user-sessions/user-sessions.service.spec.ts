import { NotFoundException, UnauthorizedException } from '@nestjs/common';

import { UserSession } from './entities/user-session.entity';
import { UserSessionsService } from './user-sessions.service';
import { apiMessage } from '../common/i18n/api-message';

describe('UserSessionsService', () => {
  const userId = 'user-1';
  let sessions: UserSession[];
  let repository: {
    create: jest.Mock;
    save: jest.Mock;
    find: jest.Mock;
    findOne: jest.Mock;
    update: jest.Mock;
  };
  let service: UserSessionsService;

  beforeEach(() => {
    sessions = [];
    repository = {
      create: jest.fn((session: Partial<UserSession>) => ({
        id: `session-${sessions.length + 1}`,
        isRevoked: false,
        createdAt: new Date(),
        lastActiveAt: new Date(),
        revokedAt: null,
        ...session,
      })),
      save: jest.fn((session: UserSession) => {
        const existingIndex = sessions.findIndex(({ id }) => id === session.id);
        if (existingIndex >= 0) {
          sessions[existingIndex] = session;
        } else {
          sessions.push(session);
        }

        return session;
      }),
      find: jest.fn(({ where }: { where: Partial<UserSession> }) =>
        sessions.filter(
          (session) =>
            session.userId === where.userId &&
            session.isRevoked === where.isRevoked,
        ),
      ),
      findOne: jest.fn(
        ({ where }: { where: Partial<UserSession> }) =>
          sessions.find(
            (session) =>
              session.id === where.id && session.userId === where.userId,
          ) ?? null,
      ),
      update: jest.fn(
        (where: Partial<UserSession>, patch: Partial<UserSession>) => {
          sessions.forEach((session) => {
            if (
              matchesWhereValue(where.id, session.id) &&
              matchesWhereValue(where.userId, session.userId) &&
              matchesWhereValue(where.isRevoked, session.isRevoked)
            ) {
              Object.assign(session, patch);
            }
          });
        },
      ),
    };

    service = new UserSessionsService(repository as never);
  });

  it('creates a session with device metadata', async () => {
    await expect(
      service.createSession(userId, {
        deviceName: 'MacBook Pro 16"',
        deviceType: 'desktop',
        browserName: 'Chrome',
        osName: 'macOS',
        ipAddress: '127.0.0.1',
        userAgent: 'Mozilla/5.0',
      }),
    ).resolves.toMatchObject({
      userId,
      deviceName: 'MacBook Pro 16"',
      deviceType: 'desktop',
      browserName: 'Chrome',
      osName: 'macOS',
      ipAddress: '127.0.0.1',
      userAgent: 'Mozilla/5.0',
      isRevoked: false,
    });
  });

  it('lists active sessions and marks the current one', async () => {
    const current = await service.createSession(userId, {
      deviceName: 'Current',
    });
    await service.createSession(userId, { deviceName: 'Other' });
    await service.createSession('other-user', { deviceName: 'Foreign' });

    await expect(
      service.getActiveSessions(userId, current.id),
    ).resolves.toEqual(
      expect.arrayContaining([
        expect.objectContaining({ id: current.id, isCurrent: true }),
        expect.objectContaining({ deviceName: 'Other', isCurrent: false }),
      ]),
    );
  });

  it('revokes a specific session', async () => {
    const session = await service.createSession(userId, {
      deviceName: 'iPhone',
    });

    await expect(service.revokeSession(userId, session.id)).resolves.toEqual({
      message: apiMessage('api.messages.session_revoked_successfully'),
    });
    expect(session.isRevoked).toBe(true);
    expect(session.revokedAt).toBeInstanceOf(Date);
  });

  it('throws when revoking an unknown session', async () => {
    await expect(
      service.revokeSession(userId, 'missing'),
    ).rejects.toBeInstanceOf(NotFoundException);
  });

  it('revokes all other sessions and preserves the current one', async () => {
    const current = await service.createSession(userId, {
      deviceName: 'Current',
    });
    const other = await service.createSession(userId, { deviceName: 'Other' });

    await service.revokeAllOtherSessions(userId, current.id);

    expect(current.isRevoked).toBe(false);
    expect(other.isRevoked).toBe(true);
  });

  it('rejects inactive sessions during JWT validation', async () => {
    const session = await service.createSession(userId, {
      deviceName: 'Revoked',
    });
    await service.revokeSession(userId, session.id);

    await expect(
      service.assertActiveSession(userId, session.id),
    ).rejects.toBeInstanceOf(UnauthorizedException);
  });
});

function matchesWhereValue<T>(whereValue: unknown, value: T) {
  if (whereValue === undefined) return true;
  if (
    typeof whereValue === 'object' &&
    whereValue !== null &&
    '_type' in whereValue &&
    '_value' in whereValue &&
    whereValue._type === 'not'
  ) {
    return whereValue._value !== value;
  }

  return whereValue === value;
}
