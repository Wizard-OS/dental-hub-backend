import { GoogleAuthenticationError } from '../domain/google-identity';
import type { GoogleIdentity } from '../domain/google-identity';

export interface GoogleIdentityVerifier {
  verify(idToken: string): Promise<GoogleIdentity>;
}

export interface GoogleAccount {
  id: string;
  email: string;
  isActive: boolean;
  googleSubject: string | null;
  passwordHash: string | null;
}

export interface GoogleAccountRepository {
  bySubject(subject: string): Promise<GoogleAccount | null>;
  byEmail(email: string): Promise<GoogleAccount | null>;
  byId(id: string): Promise<GoogleAccount | null>;
  create(identity: GoogleIdentity): Promise<string>;
  link(id: string, identity: GoogleIdentity): Promise<void>;
  matchesPassword(password: string, hash: string): boolean;
}

export class GoogleAuthentication {
  constructor(
    private readonly verifier: GoogleIdentityVerifier,
    private readonly accounts: GoogleAccountRepository,
  ) {}

  async login(idToken: string, existingPassword?: string): Promise<string> {
    const identity = await this.verifier.verify(idToken);
    const linkedAccount = await this.accounts.bySubject(identity.subject);
    if (linkedAccount) {
      this.assertActive(linkedAccount);
      await this.accounts.link(linkedAccount.id, identity);
      return linkedAccount.id;
    }
    const emailAccount = await this.accounts.byEmail(identity.email);
    if (!emailAccount) return this.accounts.create(identity);
    this.assertActive(emailAccount);
    this.assertLinkable(emailAccount, identity);
    this.assertPassword(emailAccount, existingPassword);
    await this.accounts.link(emailAccount.id, identity);
    return emailAccount.id;
  }

  async link(
    userId: string,
    idToken: string,
    currentPassword?: string,
  ): Promise<void> {
    const identity = await this.verifier.verify(idToken);
    const account = await this.accounts.byId(userId);
    if (!account) {
      throw new GoogleAuthenticationError(
        'ACCOUNT_NOT_FOUND',
        'Account is unavailable.',
      );
    }
    this.assertActive(account);
    this.assertLinkable(account, identity);
    const linked = await this.accounts.bySubject(identity.subject);
    if (linked && linked.id !== userId) {
      throw new GoogleAuthenticationError(
        'GOOGLE_IDENTITY_CONFLICT',
        'This Google account is already linked to another user.',
      );
    }
    if (account.googleSubject === identity.subject) return;
    this.assertPassword(account, currentPassword);
    await this.accounts.link(userId, identity);
  }

  private assertActive(account: GoogleAccount): void {
    if (!account.isActive) {
      throw new GoogleAuthenticationError(
        'ACCOUNT_INACTIVE',
        'This account is inactive.',
      );
    }
  }

  private assertLinkable(
    account: GoogleAccount,
    identity: GoogleIdentity,
  ): void {
    if (
      account.email.trim().toLowerCase() !==
        identity.email.trim().toLowerCase() ||
      (account.googleSubject && account.googleSubject !== identity.subject)
    ) {
      throw new GoogleAuthenticationError(
        'GOOGLE_IDENTITY_CONFLICT',
        'Use the Google account matching your DentalHub account.',
      );
    }
  }

  private assertPassword(account: GoogleAccount, password?: string): void {
    if (!password) {
      throw new GoogleAuthenticationError(
        'GOOGLE_ACCOUNT_LINK_REQUIRED',
        'Confirm your existing DentalHub password to link Google.',
      );
    }
    if (
      !account.passwordHash ||
      !this.accounts.matchesPassword(password, account.passwordHash)
    ) {
      throw new GoogleAuthenticationError(
        'INVALID_PASSWORD',
        'Your existing password is incorrect.',
      );
    }
  }
}
