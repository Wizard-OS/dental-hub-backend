export interface GoogleDriveIdentity {
  subject: string;
  email: string;
}

export interface GoogleIdentityVerifier {
  verify(idToken: string): Promise<GoogleDriveIdentity>;
}
