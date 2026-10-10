import {
  DriveAuthorization,
  DriveMigrationProgress,
  PersonalDriveContext,
  PersonalDriveError,
  PersonalDriveStatus,
} from '../domain/personal-drive';

export interface PersonalDrivePort {
  exchangeCode(code: string, idToken?: string): Promise<DriveAuthorization>;
  connect(
    userId: string,
    authorization: DriveAuthorization,
  ): Promise<PersonalDriveStatus>;
  status(userId: string): Promise<PersonalDriveStatus>;
  disconnect(userId: string, confirmFilesBackedUp?: boolean): Promise<void>;
  migrate(
    userId: string,
    context: PersonalDriveContext,
    retry: boolean,
  ): Promise<DriveMigrationProgress>;
  migrationStatus(
    userId: string,
    context: PersonalDriveContext,
  ): Promise<DriveMigrationProgress>;
  sync(
    userId: string,
    context: PersonalDriveContext,
  ): Promise<{
    provider: 'google_drive';
    scanned: number;
    updated: number;
    unavailable: number;
  }>;
  syncConnectedIntegrations(): Promise<void>;
  handleDriveNotification(
    channelId: string,
    channelToken: string,
  ): Promise<boolean>;
}

export class PersonalDrive {
  constructor(private readonly port: PersonalDrivePort) {}

  async connect(userId: string, serverAuthCode: string, idToken?: string) {
    const authorization = await this.port.exchangeCode(serverAuthCode, idToken);
    if (
      !authorization.scope
        .split(' ')
        .includes('https://www.googleapis.com/auth/drive.file')
    )
      throw new PersonalDriveError(
        'DRIVE_SCOPE_REQUIRED',
        'Allow DentalHub to store its files in Google Drive.',
      );
    return this.port.connect(userId, authorization);
  }
  status(userId: string) {
    return this.port.status(userId);
  }
  disconnect(userId: string, confirmFilesBackedUp = false) {
    return this.port.disconnect(userId, confirmFilesBackedUp);
  }
  migrate(userId: string, context: PersonalDriveContext, retry = false) {
    return this.port.migrate(userId, context, retry);
  }
  migrationStatus(userId: string, context: PersonalDriveContext) {
    return this.port.migrationStatus(userId, context);
  }
  sync(userId: string, context: PersonalDriveContext) {
    return this.port.sync(userId, context);
  }
  syncConnectedIntegrations() {
    return this.port.syncConnectedIntegrations();
  }
  handleDriveNotification(channelId: string, channelToken: string) {
    return this.port.handleDriveNotification(channelId, channelToken);
  }
}
