export interface GoogleIdentity {
  subject: string;
  email: string;
  firstName: string;
  lastName: string;
  photoUrl?: string;
}

export class GoogleAuthenticationError extends Error {
  constructor(
    public readonly code: string,
    message: string,
  ) {
    super(message);
  }
}
