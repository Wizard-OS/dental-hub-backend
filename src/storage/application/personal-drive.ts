import { GoogleIdentityVerifier } from '../../auth/application/google-authentication';
import {
  DriveAuthorization,
  DriveMigrationProgress,
  PersonalDriveContext,
  PersonalDriveError,
  PersonalDriveStatus,
} from '../domain/personal-drive';

export interface PersonalDrivePort {
  subjectForUser(userId: string): Promise<string | null>;
  exchangeCode(code: string): Promise<DriveAuthorization>;
  connect(
    userId: string,
    authorization: DriveAuthorization,
  ): Promise<PersonalDriveStatus>;
  status(userId: string): Promise<PersonalDriveStatus>;
  disconnect(userId: string): Promise<void>;
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
}

export class PersonalDrive {
  constructor(
    private readonly port: PersonalDrivePort,
    private readonly identities: GoogleIdentityVerifier,
  ) {}
  async connect(userId: string, idToken: string, serverAuthCode: string) {
    const identity = await this.identities.verify(idToken);
    if (identity.subject !== (await this.port.subjectForUser(userId)))
      throw new PersonalDriveError(
        'DRIVE_ACCOUNT_MISMATCH',
        'Connect the Google account linked to your DentalHub login.',
      );
    const authorization = await this.port.exchangeCode(serverAuthCode);
    if (authorization.subject !== identity.subject)
      throw new PersonalDriveError(
        'DRIVE_ACCOUNT_MISMATCH',
        'Drive permission was granted by a different Google account.',
      );
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
  disconnect(userId: string) {
    return this.port.disconnect(userId);
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
}
