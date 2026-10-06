/* eslint-disable @typescript-eslint/unbound-method -- Jest assertions inspect mocked methods without invoking them. */
import { PersonalDrive, PersonalDrivePort } from './personal-drive';
import { GoogleIdentityVerifier } from '../../auth/application/google-authentication';

describe('PersonalDrive connection identity', () => {
  const authorization = {
    subject: 'subject-a',
    email: 'a@example.test',
    accessToken: 'access',
    refreshToken: 'refresh',
    scope: 'openid https://www.googleapis.com/auth/drive.file',
  };
  let port: jest.Mocked<PersonalDrivePort>;
  let verifier: jest.Mocked<GoogleIdentityVerifier>;
  let drive: PersonalDrive;
  beforeEach(() => {
    port = {
      subjectForUser: jest.fn().mockResolvedValue('subject-a'),
      exchangeCode: jest.fn().mockResolvedValue(authorization),
      connect: jest.fn().mockResolvedValue({ connected: true }),
      status: jest.fn(),
      disconnect: jest.fn(),
      migrate: jest.fn(),
      migrationStatus: jest.fn(),
      sync: jest.fn(),
    };
    verifier = {
      verify: jest.fn().mockResolvedValue({
        subject: 'subject-a',
        email: 'a@example.test',
        firstName: 'A',
        lastName: '',
      }),
    };
    drive = new PersonalDrive(port, verifier);
  });
  it('binds consent to the authenticated app user and verified Google subject', async () => {
    await expect(
      drive.connect('user-a', 'id-token', 'code'),
    ).resolves.toMatchObject({ connected: true });
    expect(port.connect).toHaveBeenCalledWith('user-a', authorization);
  });
  it('rejects a token from a different signed-in Google account before exchange', async () => {
    port.subjectForUser.mockResolvedValue('subject-b');
    await expect(
      drive.connect('user-b', 'id-token', 'code'),
    ).rejects.toMatchObject({ code: 'DRIVE_ACCOUNT_MISMATCH' });
    expect(port.exchangeCode).not.toHaveBeenCalled();
  });
  it('rejects an authorization code issued to another account', async () => {
    port.exchangeCode.mockResolvedValue({
      ...authorization,
      subject: 'subject-b',
    });
    await expect(
      drive.connect('user-a', 'id-token', 'code'),
    ).rejects.toMatchObject({ code: 'DRIVE_ACCOUNT_MISMATCH' });
    expect(port.connect).not.toHaveBeenCalled();
  });
  it('rejects consent that omits file permission', async () => {
    port.exchangeCode.mockResolvedValue({
      ...authorization,
      scope: 'openid email',
    });
    await expect(
      drive.connect('user-a', 'id-token', 'code'),
    ).rejects.toMatchObject({ code: 'DRIVE_SCOPE_REQUIRED' });
    expect(port.connect).not.toHaveBeenCalled();
  });
});
