import {
  Injectable,
  NotFoundException,
  UnauthorizedException,
} from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Not, Repository, FindOptionsWhere } from 'typeorm';

import { UserSession } from './entities/user-session.entity';
import { SessionMetadata } from './device-metadata.util';

export type UserSessionResponse = UserSession & { isCurrent: boolean };

@Injectable()
export class UserSessionsService {
  constructor(
    @InjectRepository(UserSession)
    private readonly sessionRepository: Repository<UserSession>,
  ) {}

  async createSession(
    userId: string,
    metadata: SessionMetadata,
  ): Promise<UserSession> {
    const session = this.sessionRepository.create({
      userId,
      ...metadata,
    });
    return await this.sessionRepository.save(session);
  }

  async getActiveSessions(
    userId: string,
    currentSessionId?: string,
  ): Promise<UserSessionResponse[]> {
    const sessions = await this.sessionRepository.find({
      where: { userId, isRevoked: false },
      order: { lastActiveAt: 'DESC' },
    });

    return sessions.map((session) =>
      Object.assign(session, { isCurrent: session.id === currentSessionId }),
    );
  }

  async revokeSession(
    userId: string,
    sessionId: string,
  ): Promise<{ message: string }> {
    const session = await this.sessionRepository.findOne({
      where: { id: sessionId, userId },
    });

    if (!session) {
      throw new NotFoundException('Session not found');
    }

    const now = new Date();
    session.isRevoked = true;
    session.revokedAt = now;
    session.lastActiveAt = now;
    await this.sessionRepository.save(session);

    return { message: 'Session revoked successfully' };
  }

  async revokeAllOtherSessions(
    userId: string,
    currentSessionId?: string,
  ): Promise<{ message: string }> {
    const where: FindOptionsWhere<UserSession> = { userId, isRevoked: false };
    if (currentSessionId) {
      where.id = Not(currentSessionId);
    }

    const now = new Date();
    await this.sessionRepository.update(where, {
      isRevoked: true,
      revokedAt: now,
      lastActiveAt: now,
    });

    return { message: 'All other sessions revoked successfully' };
  }

  async assertActiveSession(
    userId: string,
    sessionId: string,
  ): Promise<UserSession> {
    const session = await this.sessionRepository.findOne({
      where: { id: sessionId, userId },
    });

    if (!session || session.isRevoked) {
      throw new UnauthorizedException('Session not valid');
    }

    return session;
  }

  async updateLastActive(sessionId: string): Promise<void> {
    await this.sessionRepository.update(
      { id: sessionId, isRevoked: false },
      {
        lastActiveAt: new Date(),
      },
    );
  }

  async revokeCurrentSession(
    userId: string,
    currentSessionId: string,
  ): Promise<{ message: string }> {
    await this.revokeSession(userId, currentSessionId);

    return {
      message: 'Logged out successfully',
    };
  }
}
