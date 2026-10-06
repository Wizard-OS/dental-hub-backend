import {
  GoogleAuthenticationError,
  GoogleIdentity,
} from '../domain/google-identity';

export interface GoogleIdentityVerifier {
  verify(idToken: string): Promise<GoogleIdentity>;
}

export interface GoogleAccount {
  id: string;
  email: string;
  isActive: boolean;
  googleSubject: string | null;
  password: string | null;
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
    const linked = await this.accounts.bySubject(identity.subject);
    if (linked) {
      this.assertActive(linked);
      await this.accounts.link(linked.id, identity);
      return linked.id;
    }
    const existing = await this.accounts.byEmail(identity.email);
    if (!existing) return this.accounts.create(identity);
    this.assertActive(existing);
    this.assertLinkable(existing, identity);
    this.assertPassword(existing, existingPassword);
    await this.accounts.link(existing.id, identity);
    return existing.id;
  }

  async link(
    userId: string,
    idToken: string,
    currentPassword?: string,
  ): Promise<void> {
    const identity = await this.verifier.verify(idToken);
    const account = await this.accounts.byId(userId);
    if (!account)
      throw new GoogleAuthenticationError(
        'ACCOUNT_NOT_FOUND',
        'Account is unavailable.',
      );
    this.assertActive(account);
    this.assertLinkable(account, identity);
    const linked = await this.accounts.bySubject(identity.subject);
    if (linked && linked.id !== userId)
      throw new GoogleAuthenticationError(
        'GOOGLE_IDENTITY_CONFLICT',
        'This Google account is already linked to another user.',
      );
    if (account.googleSubject === identity.subject) return;
    this.assertPassword(account, currentPassword);
    await this.accounts.link(userId, identity);
  }

  private assertActive(account: GoogleAccount) {
    if (!account.isActive)
      throw new GoogleAuthenticationError(
        'ACCOUNT_INACTIVE',
        'This account is inactive.',
      );
  }

  private assertLinkable(account: GoogleAccount, identity: GoogleIdentity) {
    if (
      account.email.toLowerCase() !== identity.email.toLowerCase() ||
      (account.googleSubject && account.googleSubject !== identity.subject)
    ) {
      throw new GoogleAuthenticationError(
        'GOOGLE_IDENTITY_CONFLICT',
        'Use the Google account matching your DentalHub account.',
      );
    }
  }

  private assertPassword(account: GoogleAccount, password?: string) {
    if (!password)
      throw new GoogleAuthenticationError(
        'GOOGLE_ACCOUNT_LINK_REQUIRED',
        'Confirm your existing DentalHub password to link Google.',
      );
    if (
      !account.password ||
      !this.accounts.matchesPassword(password, account.password)
    )
      throw new GoogleAuthenticationError(
        'INVALID_PASSWORD',
        'Your existing password is incorrect.',
      );
  }
}
