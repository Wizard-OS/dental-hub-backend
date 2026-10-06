/* eslint-disable @typescript-eslint/unbound-method -- Jest assertions inspect mocked methods without invoking them. */
import {
  GoogleAuthentication,
  GoogleAccountRepository,
  GoogleIdentityVerifier,
} from './google-authentication';

describe('GoogleAuthentication', () => {
  const identity = {
    subject: 'google-subject',
    email: 'doctor@example.test',
    firstName: 'Ana',
    lastName: 'Silva',
  };
  let verifier: jest.Mocked<GoogleIdentityVerifier>;
  let accounts: jest.Mocked<GoogleAccountRepository>;
  let google: GoogleAuthentication;
  beforeEach(() => {
    verifier = { verify: jest.fn().mockResolvedValue(identity) };
    accounts = {
      bySubject: jest.fn().mockResolvedValue(null),
      byEmail: jest.fn().mockResolvedValue(null),
      byId: jest.fn().mockResolvedValue(null),
      create: jest.fn().mockResolvedValue('new-user'),
      link: jest.fn().mockResolvedValue(undefined),
      matchesPassword: jest.fn().mockReturnValue(true),
    };
    google = new GoogleAuthentication(verifier, accounts);
  });
  it('creates a Google-only account only after verified identity', async () => {
    await expect(google.login('id-token')).resolves.toBe('new-user');
    expect(verifier.verify).toHaveBeenCalledWith('id-token');
    expect(accounts.create).toHaveBeenCalledWith(identity);
  });
  it('preserves the existing user identity and does not create another account', async () => {
    accounts.bySubject.mockResolvedValue({
      id: 'existing',
      email: identity.email,
      googleSubject: identity.subject,
      passwordHash: null,
      isActive: true,
    });
    await expect(google.login('id-token')).resolves.toBe('existing');
    expect(accounts.create).not.toHaveBeenCalled();
  });
  it('requires a password before linking an email match', async () => {
    accounts.byEmail.mockResolvedValue({
      id: 'password-user',
      email: identity.email,
      googleSubject: null,
      passwordHash: 'hash',
      isActive: true,
    });
    await expect(google.login('id-token')).rejects.toMatchObject({
      code: 'GOOGLE_ACCOUNT_LINK_REQUIRED',
    });
    expect(accounts.link).not.toHaveBeenCalled();
    await expect(google.login('id-token', 'password')).resolves.toBe(
      'password-user',
    );
    expect(accounts.matchesPassword).toHaveBeenCalledWith('password', 'hash');
    expect(accounts.link).toHaveBeenCalledWith('password-user', identity);
  });
  it('rejects wrong passwords without linking', async () => {
    accounts.byEmail.mockResolvedValue({
      id: 'existing',
      email: identity.email,
      googleSubject: null,
      passwordHash: 'hash',
      isActive: true,
    });
    accounts.matchesPassword.mockReturnValue(false);
    await expect(google.login('id-token', 'wrong')).rejects.toMatchObject({
      code: 'INVALID_PASSWORD',
    });
    expect(accounts.link).not.toHaveBeenCalled();
  });
  it('rejects linking someone else’s Google identity', async () => {
    accounts.byId.mockResolvedValue({
      id: 'existing',
      email: identity.email,
      googleSubject: null,
      passwordHash: 'hash',
      isActive: true,
    });
    accounts.bySubject.mockResolvedValue({
      id: 'other',
      email: identity.email,
      googleSubject: identity.subject,
      passwordHash: null,
      isActive: true,
    });
    await expect(
      google.link('existing', 'id-token', 'password'),
    ).rejects.toMatchObject({ code: 'GOOGLE_IDENTITY_CONFLICT' });
    expect(accounts.link).not.toHaveBeenCalled();
  });
  it('rejects different account emails and inactive accounts', async () => {
    accounts.byId.mockResolvedValue({
      id: 'existing',
      email: 'other@example.test',
      googleSubject: null,
      passwordHash: 'hash',
      isActive: true,
    });
    await expect(
      google.link('existing', 'id-token', 'password'),
    ).rejects.toMatchObject({ code: 'GOOGLE_IDENTITY_CONFLICT' });
    accounts.bySubject.mockResolvedValue({
      id: 'existing',
      email: identity.email,
      googleSubject: identity.subject,
      passwordHash: null,
      isActive: false,
    });
    await expect(google.login('id-token')).rejects.toMatchObject({
      code: 'ACCOUNT_INACTIVE',
    });
  });
  it('does not access accounts for an invalid Google token', async () => {
    verifier.verify.mockRejectedValue(new Error('Invalid signature'));
    await expect(google.login('invalid')).rejects.toThrow('Invalid signature');
    expect(accounts.bySubject).not.toHaveBeenCalled();
    expect(accounts.create).not.toHaveBeenCalled();
  });
});
