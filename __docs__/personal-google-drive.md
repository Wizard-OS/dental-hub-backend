# DentalHub authentication and patient files in Google Drive

DentalHub registration and email/password login create the only app sessions. Google authorization is a separate action in the signed-in user's settings: it grants that DentalHub user access to a Google Drive account for patient attachments. The Drive email does not need to match the DentalHub email, and Drive credentials never create or link an app account.

Patient images and attachments, including X-rays and history images, are stored in the uploader's managed `DentalHub` Drive folders. PostgreSQL continues to store structured clinical data and patient-file associations. App uploads create Drive files; app-side name, description, and category edits update Drive; Drive-side content and metadata changes reconcile into the patient-file record. Structured medical-history fields are not synchronized to Drive.

## Google configuration

Enable the Google Drive API and configure the consent screen. The mobile settings flow requests the `drive.file` scope and a server authorization code. Identity scopes may be requested by the Google SDK to identify the connected Drive account, but they are used only for the Drive connection; the backend does not use them for DentalHub authentication.

Configure these backend secrets:

```dotenv
GOOGLE_DRIVE_CLIENT_ID=<Web/server OAuth client ID>
GOOGLE_DRIVE_CLIENT_SECRET=<Web OAuth client secret>
INTEGRATION_TOKEN_ENCRYPTION_KEY=<persistent random 32-byte key encoded as 64 hex characters>
GOOGLE_DRIVE_WEBHOOK_URL=https://api.example.com/webhooks/google-drive/changes
GOOGLE_DRIVE_SYNC_WORKER_ENABLED=true
```

`GOOGLE_DRIVE_WEBHOOK_URL` is a public HTTPS URL. If it is unset, the five-minute background worker still reconciles connected accounts. Google change notifications trigger reconciliation sooner; notifications contain no patient data and are authenticated with a per-channel secret token. Keep the encryption key stable across deployments; changing it prevents stored refresh tokens from being decrypted.

Password reset delivery must be configured before removing Google app login:

```dotenv
RESEND_API_KEY=<Resend API key>
AUTH_EMAIL_FROM=<verified sender address>
```

If `AUTH_EMAIL_FROM` is unset, the backend uses `MEMBERSHIP_EMAIL_FROM`. Google-only DentalHub users must use **Forgot password** to set a DentalHub password before rollout. A production deployment must have a working reset-email sender before announcing the change. The old Google identity columns remain in PostgreSQL for migration history but are no longer part of app authentication.

## Storage and synchronization rules

- Each file is owned by the Google account of the DentalHub user who uploaded or imported it. Authorized clinic members access the file through the backend's clinic-scoped download route.
- DentalHub automatically reconciles files already associated with patient records and located in the managed clinic/patient/category folder tree. Unrecognized Drive files are never scanned or imported automatically.
- Import a new Drive file from the patient record with Google Picker. The selected file is validated, moved into the managed patient/category folder, and associated with that patient. This keeps the selected Drive file itself under ongoing sync.
- App uploads create files in Drive. App metadata edits update the Drive name, description, category, and association. Changes made in Drive update the patient-file record through change notifications and periodic reconciliation.
- A concurrent change is saved as a review flag and audit entry; the app does not overwrite the Drive version. Drive revision IDs/checksums and recent metadata audit entries are retained on the patient-file record for review.
- A Drive deletion or move outside the managed tree keeps the PostgreSQL patient-file record and audit history, marks the attachment unavailable, and flags it for review. Restore a trashed file from the patient-file record or move an externally moved file back into its managed folder.
- Deleting an app attachment requires an explicit confirmation before moving its Drive file to Trash. Google Drive Trash can be restored through DentalHub while the owner remains connected.
- Disconnecting an account that owns patient files requires the user to confirm that those files have been backed up or transferred. Disconnecting removes the app's credentials, not the Drive data; in-app access resumes only after the same Drive account is reconnected.

Google Drive is the live file location for these attachments, not an independent backup. Maintain a separate file backup/retention strategy. Back up and restore PostgreSQL separately for structured medical history, patient associations, and audit metadata. Verify both recovery paths during disaster-recovery exercises.

If HIPAA applies, use an eligible Google Workspace or Cloud Identity account and accept Google's BAA before storing PHI. Validate local health-data and privacy requirements separately.

## API contracts

DentalHub authentication exposes `/auth/register`, `/auth/login`, and password recovery. `/auth/google` and `/auth/google/link` are removed.

- `GET /integrations/google-drive/me/status`, `POST /integrations/google-drive/me/connect` with `{serverAuthCode}`, and `DELETE /integrations/google-drive/me/disconnect` require the DentalHub JWT. Disconnect requires `{confirmFilesBackedUp: true}` when the account owns patient files.
- `GET /integrations/google-drive/me/migration`, `POST /integrations/google-drive/me/migration` with `{retry?: boolean}`, and `POST /integrations/google-drive/me/sync` require an active clinic membership.
- `POST /patients/:patientId/files/import-from-drive` requires an authenticated clinic member and accepts `{driveFileId, type, description?, appointmentId?, clinicalNoteId?, treatmentId?}`. The Drive file ID must be selected through Google Picker and accessible with the connected `drive.file` grant.
- `PATCH /patient-files/:id` updates `originalName`, `description`, or `type` in the app and Drive. If Drive changed since the app's last sync, the API returns `DRIVE_SYNC_CONFLICT` and flags the record for review.
- `GET /patient-files/:id/drive-versions` lists Drive revisions, and `GET /patient-files/:id/drive-versions/:revisionId/download` lets an authorized clinic member inspect an earlier version.
- `POST /patient-files/:id/restore-from-drive` restores a file from Google Drive Trash.
- `DELETE /patient-files/:id` requires `{confirmDriveTrash: true}` for a Google Drive attachment.
- `POST /webhooks/google-drive/changes` is the Google Drive notification callback. It accepts Google channel headers and does not expose patient data.
- `GET /patient-files/:id/download` requires the DentalHub JWT and clinic scope. Clinic members without access to the patient cannot download or import its files.

## Rollout and acceptance

1. Configure and test password-reset email delivery. Tell Google-only users to set a DentalHub password through password recovery before the release.
2. Apply `202610040001_personal_google_drive.sql` and `202610070001_personal_drive_bidirectional_sync.sql` with `DB_SYNCHRONIZE=false`.
3. Deploy the backend. Confirm `/auth/google` and `/auth/google/link` are absent from routing and OpenAPI, while password auth and Drive settings routes remain.
4. From a DentalHub account, connect a Drive account with a different email. Upload an image, change its name/category in DentalHub, then edit its name/content in Drive and confirm the record reconciles.
5. Use Picker to import a Drive file to a patient/category; confirm it moves into that managed folder and subsequent Drive changes reconcile. Confirm an arbitrary file outside managed folders is not imported automatically.
6. Test conflict review, moving a file outside the managed tree, Drive Trash and restore, disconnect confirmation, clinic authorization, notification delivery, and periodic-worker fallback.
7. Back up and restore PostgreSQL clinical history independently from the Drive file backup/retention process.
