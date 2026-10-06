import { Injectable } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository } from 'typeorm';
import type { FindOptionsWhere, UpdateResult } from 'typeorm';
import type {
  GoogleAccount,
  GoogleAccountRepository,
} from '../application/google-authentication';
import { GoogleAuthenticationError } from '../domain/google-identity';
import type { GoogleIdentity } from '../domain/google-identity';
import { User } from '../entities/user.entity';
import { PasswordHasherService } from '../services/password-hasher.service';

@Injectable()
export class TypeOrmGoogleAccountRepository implements GoogleAccountRepository {
  constructor(
    @InjectRepository(User) private readonly users: Repository<User>,
    private readonly passwords: PasswordHasherService,
  ) {}

  private async lookup(
    where: FindOptionsWhere<User>,
  ): Promise<GoogleAccount | null> {
    const user = await this.users.findOne({
      where,
      select: {
        id: true,
        email: true,
        password: true,
        isActive: true,
        googleSubject: true,
      },
    });
    if (!user) return null;

    return {
      id: user.id,
      email: user.email,
      isActive: user.isActive,
      googleSubject: user.googleSubject,
      passwordHash: user.password ?? null,
    };
  }

  bySubject(subject: string): Promise<GoogleAccount | null> {
    return this.lookup({ googleSubject: subject });
  }

  byEmail(email: string): Promise<GoogleAccount | null> {
    return this.lookup({ email });
  }

  byId(id: string): Promise<GoogleAccount | null> {
    return this.lookup({ id });
  }

  matchesPassword(password: string, passwordHash: string): boolean {
    return this.passwords.compare(password, passwordHash);
  }

  async create(identity: GoogleIdentity): Promise<string> {
    try {
      const user = await this.users.save(
        this.users.create({
          email: identity.email,
          firstName: identity.firstName,
          lastName: identity.lastName,
          password: null,
          googleSubject: identity.subject,
          googleEmail: identity.email,
          profilePhotoUrl: identity.photoUrl,
        }),
      );
      return user.id;
    } catch (error) {
      this.handleConflict(error);
    }
  }

  async link(id: string, identity: GoogleIdentity): Promise<void> {
    let result: UpdateResult;
    try {
      // Conditional update prevents concurrent requests replacing a linked identity.
      result = await this.users
        .createQueryBuilder()
        .update(User)
        .set({ googleSubject: identity.subject, googleEmail: identity.email })
        .where('id = :id', { id })
        .andWhere('("googleSubject" IS NULL OR "googleSubject" = :subject)', {
          subject: identity.subject,
        })
        .execute();
    } catch (error) {
      this.handleConflict(error);
    }
    if (result.affected !== 1) {
      throw new GoogleAuthenticationError(
        'GOOGLE_IDENTITY_CONFLICT',
        'This account is already linked to another Google identity.',
      );
    }
  }

  private handleConflict(error: unknown): never {
    if (
      typeof error === 'object' &&
      error !== null &&
      'code' in error &&
      error.code === '23505'
    ) {
      throw new GoogleAuthenticationError(
        'GOOGLE_IDENTITY_CONFLICT',
        'This Google identity or email is already registered. Please sign in again.',
      );
    }
    throw error;
  }
}
