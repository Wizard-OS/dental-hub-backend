export class PersonalDriveError extends Error {
  constructor(
    public readonly code: string,
    message: string,
  ) {
    super(message);
  }
}
export interface DriveAuthorization {
  subject: string;
  email: string;
  accessToken: string;
  refreshToken?: string;
  expiresAt?: number;
  scope: string;
}
export interface PersonalDriveContext {
  clinicId: string;
  membershipId: string;
  role: string;
  permissionsJson?: Record<string, boolean>;
}
export interface DriveMigrationProgress {
  total: number;
  migrated: number;
  failed: number;
  skipped: number;
  unassigned: number;
  remaining: number;
  hasMore: boolean;
}
export interface PersonalDriveStatus {
  provider: 'google_drive';
  connected: boolean;
  status: string;
  googleEmail: string | null;
  rootFolderId: string | null;
  tokenExpiresAt: Date | null;
  metadataJson: Record<string, unknown>;
}
