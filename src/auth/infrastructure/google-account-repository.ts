import { Injectable } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository } from 'typeorm';
import { GoogleAccountRepository } from '../application/google-authentication';
import {
  GoogleAuthenticationError,
  GoogleIdentity,
} from '../domain/google-identity';
import { User } from '../entities/user.entity';
import { PasswordHasherService } from '../services/password-hasher.service';

@Injectable()
export class TypeOrmGoogleAccountRepository implements GoogleAccountRepository {
  constructor(
    @InjectRepository(User) private readonly users: Repository<User>,
    private readonly passwords: PasswordHasherService,
  ) {}
  private lookup(where: {
    id?: string;
    email?: string;
    googleSubject?: string;
  }) {
    return this.users.findOne({
      where,
      select: {
        id: true,
        email: true,
        password: true,
        isActive: true,
        googleSubject: true,
      },
    });
  }
  bySubject(subject: string) {
    return this.lookup({ googleSubject: subject });
  }
  byEmail(email: string) {
    return this.lookup({ email });
  }
  byId(id: string) {
    return this.lookup({ id });
  }
  matchesPassword(password: string, hash: string) {
    return this.passwords.compare(password, hash);
  }
  async create(identity: GoogleIdentity) {
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
  async link(id: string, identity: GoogleIdentity) {
    let affected: number | undefined;
    try {
      // Conditional update prevents concurrent requests replacing a linked identity.
      const result = await this.users
        .createQueryBuilder()
        .update(User)
        .set({ googleSubject: identity.subject, googleEmail: identity.email })
        .where('id = :id', { id })
        .andWhere('("googleSubject" IS NULL OR "googleSubject" = :subject)', {
          subject: identity.subject,
        })
        .execute();
      affected = result.affected;
    } catch (error) {
      this.handleConflict(error);
    }
    if (affected !== 1)
      throw new GoogleAuthenticationError(
        'GOOGLE_IDENTITY_CONFLICT',
        'This account is already linked to another Google identity.',
      );
  }
  private handleConflict(error: unknown): never {
    if (
      typeof error === 'object' &&
      error !== null &&
      'code' in error &&
      error.code === '23505'
    )
      throw new GoogleAuthenticationError(
        'GOOGLE_IDENTITY_CONFLICT',
        'This Google identity or email is already registered. Please sign in again.',
      );
    throw error;
  }
}
