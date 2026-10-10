import { Injectable } from '@nestjs/common';
import { DataSource, Repository } from 'typeorm';

import { User } from '../entities/user.entity';
import { UserSession } from '../../user-sessions/entities/user-session.entity';
import {
  AuthSecurityAccount,
  AuthSecurityTransactionPort,
  LockedAuthSecurityAccount,
} from '../application/ports/auth-security-transaction.port';
import type { SessionMetadata } from '../../user-sessions/device-metadata.util';

@Injectable()
export class TypeOrmAuthSecurityTransactionAdapter implements AuthSecurityTransactionPort {
  constructor(private readonly dataSource: DataSource) {}

  withLockedAccountById<T>(
    userId: string,
    operation: (account: LockedAuthSecurityAccount | null) => Promise<T>,
  ): Promise<T> {
    return this.withLockedAccount(
      (repository) =>
        repository.where('user.id = :userId', { userId }).getOne(),
      operation,
    );
  }

  withLockedAccountByEmail<T>(
    email: string,
    operation: (account: LockedAuthSecurityAccount | null) => Promise<T>,
  ): Promise<T> {
    return this.withLockedAccount(
      (repository) =>
        repository
          .where('user.email = :email', { email: email.toLowerCase().trim() })
          .getOne(),
      operation,
    );
  }

  private withLockedAccount<T>(
    find: (
      query: ReturnType<Repository<User>['createQueryBuilder']>,
    ) => Promise<User | null>,
    operation: (account: LockedAuthSecurityAccount | null) => Promise<T>,
  ): Promise<T> {
    return this.dataSource.transaction(async (manager) => {
      const query = manager
        .getRepository(User)
        .createQueryBuilder('user')
        .addSelect([
          'user.password',
          'user.passwordResetOtpHash',
          'user.passwordResetOtpExpiresAt',
          'user.passwordResetOtpUsedAt',
          'user.passwordResetOtpAttemptCount',
          'user.passwordResetOtpLockedUntil',
        ])
        .setLock('pessimistic_write');
      const user = await find(query);
      if (!user) return operation(null);

      const account = this.toAccount(user);
      return operation({
        account,
        update: async (patch) => {
          await manager.getRepository(User).update(user.id, patch);
          Object.assign(account, patch);
        },
        createSession: async (metadata: SessionMetadata) => {
          const sessions = manager.getRepository(UserSession);
          const session = await sessions.save(
            sessions.create({ userId: user.id, ...metadata }),
          );
          return session.id;
        },
        revokeSessions: async (exceptSessionId?: string) => {
          const sessions = manager
            .getRepository(UserSession)
            .createQueryBuilder()
            .update(UserSession)
            .set({ isRevoked: true, revokedAt: new Date() })
            .where('"userId" = :userId AND "isRevoked" = false', {
              userId: user.id,
            });
          if (exceptSessionId) {
            sessions.andWhere('"id" != :exceptSessionId', { exceptSessionId });
          }
          await sessions.execute();
        },
      });
    });
  }

  private toAccount(user: User): AuthSecurityAccount {
    return {
      id: user.id,
      email: user.email,
      isActive: user.isActive,
      password: user.password,
      passwordResetOtpHash: user.passwordResetOtpHash ?? null,
      passwordResetOtpExpiresAt: user.passwordResetOtpExpiresAt ?? null,
      passwordResetOtpUsedAt: user.passwordResetOtpUsedAt ?? null,
      passwordResetOtpAttemptCount: user.passwordResetOtpAttemptCount ?? 0,
      passwordResetOtpLockedUntil: user.passwordResetOtpLockedUntil ?? null,
    };
  }
}
