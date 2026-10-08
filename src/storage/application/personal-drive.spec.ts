/* eslint-disable @typescript-eslint/unbound-method -- Jest assertions inspect mocked methods without invoking them. */
import { PersonalDrive, PersonalDrivePort } from './personal-drive';

describe('PersonalDrive connection identity', () => {
  const authorization = {
    subject: 'subject-a',
    email: 'a@example.test',
    accessToken: 'access',
    refreshToken: 'refresh',
    scope: 'openid https://www.googleapis.com/auth/drive.file',
  };
  let port: jest.Mocked<PersonalDrivePort>;
  let drive: PersonalDrive;
  beforeEach(() => {
    port = {
      exchangeCode: jest.fn().mockResolvedValue(authorization),
      connect: jest.fn().mockResolvedValue({ connected: true }),
      status: jest.fn(),
      disconnect: jest.fn(),
      migrate: jest.fn(),
      migrationStatus: jest.fn(),
      sync: jest.fn(),
      syncConnectedIntegrations: jest.fn(),
      handleDriveNotification: jest.fn(),
    };
    drive = new PersonalDrive(port);
  });
  it('binds Drive consent to the authenticated app user without requiring Google app login', async () => {
    await expect(drive.connect('user-a', 'code')).resolves.toMatchObject({
      connected: true,
    });
    expect(port.connect).toHaveBeenCalledWith('user-a', authorization);
  });
  it('rejects consent that omits file permission', async () => {
    port.exchangeCode.mockResolvedValue({
      ...authorization,
      scope: 'openid email',
    });
    await expect(drive.connect('user-a', 'code')).rejects.toMatchObject({
      code: 'DRIVE_SCOPE_REQUIRED',
    });
    expect(port.connect).not.toHaveBeenCalled();
  });
});
