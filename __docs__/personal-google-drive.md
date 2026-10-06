# Google login and personal Google Drive storage

The app supports Android and iOS Google sign-in alongside password login. Each uploader connects their own Google account. Patient records, clinic permissions, and file metadata stay in PostgreSQL. Patient file content goes into the uploader's private `DentalHub` Drive folder, grouped by clinic, patient, and file category. Authorized clinic colleagues read files through the authenticated backend download endpoint.

## Google project setup

Use the existing `dentalhub-a4217` Google/Firebase project and enable the Google Drive API. Configure the OAuth consent screen with the app name, support email, privacy policy, and test users while the app is in testing. Request `openid`, `email`, `profile`, and `https://www.googleapis.com/auth/drive.file`. No service account is used.

Create these OAuth clients in the same project:

- A Web application client for the backend. Its client ID is the server client ID used by both mobile platforms. Keep its client secret on the backend. Native server authorization codes use an empty redirect URI; the app does not send Google consent through the old `dentalhub://` browser callback.
- An Android client for `com.wizardos.dentalHub`, registered with the debug signing SHA-1 and each release/Play App Signing SHA-1. Enable Google sign-in in Firebase and download the refreshed `android/app/google-services.json` when applicable. Never replace signing certificates with invented values.
- An iOS client for `com.wizardos.dentalHub`. Its reversed client ID is registered in the app URL schemes through `GoogleOAuth.xcconfig`.

Configure the non-secret client IDs:

```sh
python3 scripts/configure_google_oauth.py \
  --server-client-id YOUR_WEB_CLIENT_ID.apps.googleusercontent.com \
  --ios-client-id YOUR_IOS_CLIENT_ID.apps.googleusercontent.com
flutter run --dart-define-from-file=config/google_oauth.json
```

The script validates both IDs, writes the Dart build configuration, and updates the iOS build settings. The actual IDs start with the Google project number and a hyphen. The placeholders above must be replaced. Flutter release builds must also use `--dart-define-from-file=config/google_oauth.json`. Missing IDs disable sign-in with a readable configuration error.

Official platform setup: [Android plugin](https://pub.dev/packages/google_sign_in_android), [iOS plugin](https://pub.dev/packages/google_sign_in_ios).

## Backend setup and deployment

In the adjacent `dental-hub-backend`, configure the deployment environment:

```dotenv
GOOGLE_DRIVE_CLIENT_ID=<same Web/server client ID used by the app>
GOOGLE_DRIVE_CLIENT_SECRET=<Web OAuth client secret>
INTEGRATION_TOKEN_ENCRYPTION_KEY=<persistent random 32-byte key encoded as 64 hex characters>
```

Generate the encryption key once with `openssl rand -hex 32`, store it as a deployment secret, and keep it stable across redeploys. Changing it prevents existing credentials from being decrypted. Do not put the client secret or encryption key in Flutter configuration, source control, logs, or API responses.

Deploy in this order:

1. Apply `202610040001_personal_google_drive.sql` using the existing `pnpm migrate:sql` runner with `DB_SYNCHRONIZE=false`.
2. Deploy the backend and verify `/auth/google` and the personal Drive endpoints are present.
3. Build and deploy the mobile app with the matching client IDs.

Cloud project registration, real credential provisioning, and device account consent are required for a live sign-in test. Compilation and mocked tests do not verify these steps.

## Login, ownership, and migration

Google authentication produces the existing DentalHub JWT/session. Email matches require the existing password once before linking. Google-only users may establish a password through the existing email OTP reset flow. Google identity is tied to its stable `sub`, rather than email alone.

Drive setup is offered after Google login and is available later under Profile > Google Drive. Login and clinic records remain usable when setup is skipped; new file uploads require a connected Drive. Google cancellation is not an app logout. Missing offline authorization requires sign-out/sign-in and renewed consent. The backend preserves a stored refresh token when Google omits it on a later exchange.

Migration starts after connection and resumes when the Drive settings screen is opened. It processes up to ten files per request and persists per-file progress. Only files attributable to the current uploader in the current clinic are eligible; the user's current patient permissions are checked. The app shows migrated, remaining, failed, skipped, and unassigned counts, with a retry action. Opening another clinic's settings resumes that clinic's files.

Migration verifies content size and checksum before switching the file reference. File IDs and patient avatar references stay intact. Local source copies are removed after the database commit; original legacy Drive copies remain. Missing sources, unknown uploaders, and denied access leave the original reference intact. Upload recovery locates app-created Drive content by the existing file ID to prevent repeated migration from duplicating content.

Existing clinic integrations remain for reading old files. New uploads use the personal integration. A file stores its integration ID, so viewing or deleting it uses its owner's credentials. Disconnecting clears credentials and blocks uploads and in-app access to that user's Drive files until reconnection; it does not delete Drive content. Logging out revokes the app session and clears account-specific file caches and temporary documents while retaining the server Drive connection for authorized colleagues.

`drive.file` access is limited to app-created or explicitly authorized files. Refresh updates existing app records and detects missing/trashed files; it does not import arbitrary files manually placed in Drive.

## API contracts

- `POST /auth/google`: `{idToken, existingPassword?}`. Returns the existing auth response plus `hasPassword` and `googleEmail`. A matching unlinked account returns HTTP 409 with `GOOGLE_ACCOUNT_LINK_REQUIRED` until its password is confirmed.
- `POST /auth/google/link`: authenticated `{idToken, currentPassword?}`. Requires the matching account email and existing password for a new link.
- `GET /integrations/google-drive/me/status`, `POST .../connect` with `{idToken, serverAuthCode}`, and `DELETE .../disconnect`: scoped to the JWT user; no clinic header is needed.
- `GET .../migration`, `POST .../migration` with `{retry?: boolean}`, and `POST .../sync`: require the active `x-clinic-id` and clinic membership.
- `GET /patient-files/:id/download`: requires the app JWT and clinic header for both legacy/local and personal Drive content. Files remain private in Google Drive.

Storage failures use actionable HTTP 409 errors such as `DRIVE_CONNECTION_REQUIRED`, `DRIVE_ACCOUNT_MISMATCH`, or `DRIVE_RECONNECT_REQUIRED`; they do not invalidate the DentalHub session.

## Live acceptance checks

Use two Google test accounts in one clinic. Sign each into the app, grant Drive permission, and upload an image and PDF. Confirm each upload is in its uploader's Drive, both authorized users can open the files through DentalHub, and a user from another clinic is denied. Test declining consent, reconnecting after revocation, migration retry, logout during a download, and Android/iOS debug and release client registration.
