import { apiMessage, type ApiMessage } from '../../common/i18n/api-message';
import {
  ConflictException,
  Injectable,
  NotFoundException,
} from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { IsNull, Repository } from 'typeorm';
import { google, drive_v3 } from 'googleapis';
import { OAuth2Client } from 'google-auth-library';
import { createReadStream, createWriteStream, promises as fs } from 'fs';
import { createHash, randomBytes, timingSafeEqual } from 'crypto';
import { pipeline } from 'stream/promises';
import { Readable, Transform } from 'stream';
import * as path from 'path';
import * as os from 'os';
import { GoogleTokenVerifier } from './google-identity-verifier';
import { PatientFile } from '../../patient-files/entities/patient-file.entity';
import { validateAndNormalizeUploadedFile } from '../../common/files/upload-validation';
import type { UploadedFile } from '../../common/files/uploaded-file.interface';
import { Patient } from '../../patients/entities/patient.entity';
import {
  ClinicAccessContext,
  PatientAccessService,
} from '../../patients/services/patient-access.service';
import { ClinicMembershipRole } from '../../clinic-memberships/interfaces/clinic-membership-role.enum';
import { PatientFileType } from '../../patient-files/interfaces/patient-file-type.enum';
import { PatientFileStorageStatus } from '../../patient-files/interfaces/patient-file-storage-status.enum';
import { PatientFileSyncSource } from '../../patient-files/interfaces/patient-file-sync-source.enum';
import { appendPatientFileSyncAudit } from '../../patient-files/utils/patient-file-sync-audit.util';
import { StorageProviderType } from '../interfaces/storage-provider-type.enum';
import { StorageIntegrationStatus } from '../interfaces/storage-integration-status.enum';
import { PatientFileDriveImport } from '../interfaces/patient-file-drive-import.interface';
import {
  StorageUploadInput,
  StorageUploadResult,
} from '../interfaces/storage-provider.interface';
import { UserStorageIntegration } from '../entities/user-storage-integration.entity';
import { DriveMigrationItem } from '../entities/drive-migration-item.entity';
import { ClinicStorageIntegration } from '../entities/clinic-storage-integration.entity';
import { GoogleDriveStorageProvider } from '../providers/google-drive-storage.provider';
import { TokenEncryptionService } from '../token-encryption.service';
import { getEnv } from '../../config/env';
import { PersonalDrivePort } from '../application/personal-drive';
import {
  DriveAuthorization,
  DriveMigrationProgress,
  PersonalDriveContext,
  PersonalDriveStatus,
} from '../domain/personal-drive';
import {
  buildClinicRootFolderName,
  buildDriveFileName,
  buildPatientFolderName,
  folderForPatientFileType,
  patientFileTypeFromDriveFolder,
  shortId,
} from '../utils/drive-naming.util';

@Injectable()
export class PersonalDriveStorage implements PersonalDrivePort {
  private readonly integrationSyncLocks = new Map<string, Promise<void>>();

  constructor(
    @InjectRepository(UserStorageIntegration)
    private readonly integrations: Repository<UserStorageIntegration>,
    @InjectRepository(PatientFile)
    private readonly files: Repository<PatientFile>,
    @InjectRepository(Patient)
    private readonly patients: Repository<Patient>,
    @InjectRepository(DriveMigrationItem)
    private readonly migrations: Repository<DriveMigrationItem>,
    @InjectRepository(ClinicStorageIntegration)
    private readonly legacyIntegrations: Repository<ClinicStorageIntegration>,
    private readonly tokens: TokenEncryptionService,
    private readonly verifier: GoogleTokenVerifier,
    private readonly legacyDrive: GoogleDriveStorageProvider,
    private readonly access: PatientAccessService,
  ) {}

  private oauth() {
    if (
      !process.env.GOOGLE_DRIVE_CLIENT_ID ||
      !process.env.GOOGLE_DRIVE_CLIENT_SECRET
    )
      throw this.error(
        'GOOGLE_NOT_CONFIGURED',
        apiMessage('api.messages.google_drive_is_not_configured'),
      );
    return new OAuth2Client(
      process.env.GOOGLE_DRIVE_CLIENT_ID,
      process.env.GOOGLE_DRIVE_CLIENT_SECRET,
      '',
    );
  }

  async exchangeCode(code: string): Promise<DriveAuthorization> {
    const { tokens } = await this.oauth()
      .getToken(code)
      .catch((error: unknown) => {
        if (error instanceof ConflictException) throw error;
        throw this.error(
          'DRIVE_RECONNECT_REQUIRED',
          apiMessage(
            'api.messages.drive_authorization_expired_sign_in_to_google_again_and_allow_drive_access',
          ),
        );
      });
    if (!tokens.id_token || !tokens.access_token)
      throw this.error(
        'DRIVE_RECONNECT_REQUIRED',
        apiMessage(
          'api.messages.sign_in_to_google_again_and_allow_drive_access',
        ),
      );

    const identity = await this.verifier.verify(tokens.id_token);
    return {
      subject: identity.subject,
      email: identity.email,
      accessToken: tokens.access_token,
      refreshToken: tokens.refresh_token ?? undefined,
      expiresAt: tokens.expiry_date ?? undefined,
      scope: tokens.scope ?? '',
    };
  }

  async connect(
    userId: string,
    authorization: DriveAuthorization,
  ): Promise<PersonalDriveStatus> {
    const existing = await this.credentialsByUser(userId);
    if (existing && existing.googleSubject !== authorization.subject)
      throw this.error(
        'DRIVE_ACCOUNT_MISMATCH',
        apiMessage(
          'api.messages.reconnect_the_original_google_account_to_preserve_access_to_your_files',
        ),
      );
    if (!authorization.refreshToken && !existing?.encryptedRefreshToken)
      throw this.error(
        'DRIVE_RECONNECT_REQUIRED',
        apiMessage(
          'api.messages.offline_drive_permission_is_missing_sign_in_to_google_again_and_allow',
        ),
      );
    const integration =
      existing ??
      this.integrations.create({
        userId,
        googleSubject: authorization.subject,
        rootFolderId: null,
      });
    integration.googleEmail = authorization.email;
    integration.encryptedAccessToken = this.tokens.encrypt(
      authorization.accessToken,
    );
    if (authorization.refreshToken)
      integration.encryptedRefreshToken = this.tokens.encrypt(
        authorization.refreshToken,
      );
    integration.tokenExpiresAt = authorization.expiresAt
      ? new Date(authorization.expiresAt)
      : null;
    integration.status = StorageIntegrationStatus.CONNECTED;
    // Create/validate folders before committing a connected status.
    const drive = await this.drive(integration);
    if (integration.rootFolderId) {
      const root = await drive.files
        .get({ fileId: integration.rootFolderId, fields: 'id,trashed' })
        .catch(() => null);
      if (!root || root.data.trashed)
        throw this.error(
          'DRIVE_FOLDER_UNAVAILABLE',
          apiMessage(
            'api.messages.your_dentalhub_drive_folder_is_unavailable_restore_it_in_google_drive_and',
          ),
        );
    } else {
      integration.rootFolderId = await this.legacyDrive.findOrCreateFolder(
        drive,
        'DentalHub',
        'root',
      );
    }
    integration.metadataJson = {
      ...integration.metadataJson,
      connectedAt: new Date().toISOString(),
      scope: authorization.scope,
    };
    const startToken = await drive.changes.getStartPageToken({
      fields: 'startPageToken',
    });
    integration.driveStartPageToken =
      startToken.data.startPageToken ?? integration.driveStartPageToken;
    await this.integrations.save(integration);
    await this.ensureChangeWatch(integration, drive).catch(() => undefined);
    return this.status(userId);
  }

  async status(userId: string): Promise<PersonalDriveStatus> {
    const integration = await this.integrations.findOneBy({ userId });
    return {
      provider: 'google_drive',
      connected: integration?.status === StorageIntegrationStatus.CONNECTED,
      status: integration?.status ?? StorageIntegrationStatus.DISCONNECTED,
      googleEmail: integration?.googleEmail ?? null,
      rootFolderId: integration?.rootFolderId ?? null,
      tokenExpiresAt: integration?.tokenExpiresAt ?? null,
      metadataJson: integration?.metadataJson ?? {},
    };
  }

  async disconnect(userId: string, confirmFilesBackedUp = false) {
    const integration = await this.credentialsByUser(userId);
    if (!integration) return;

    const attachedFiles = await this.files.count({
      where: { storageIntegrationId: integration.id },
    });
    if (attachedFiles > 0 && !confirmFilesBackedUp)
      throw this.error(
        'DRIVE_FILES_BACKUP_CONFIRMATION_REQUIRED',
        apiMessage(
          'api.messages.this_drive_account_owns_patient_file_s_back_them_up_or_transfer',
          { attachedFiles: attachedFiles },
        ),
      );

    if (integration.driveWatchChannelId && integration.driveWatchResourceId) {
      const drive = await this.drive(integration).catch(() => null);
      await drive?.channels
        .stop({
          requestBody: {
            id: integration.driveWatchChannelId,
            resourceId: integration.driveWatchResourceId,
          },
        })
        .catch(() => undefined);
    }
    await this.integrations.update(
      { userId },
      {
        status: StorageIntegrationStatus.DISCONNECTED,
        encryptedAccessToken: null,
        encryptedRefreshToken: null,
        tokenExpiresAt: null,
        driveWatchChannelId: null,
        driveWatchResourceId: null,
        driveWatchTokenHash: null,
        driveWatchExpiresAt: null,
      },
    );
  }

  async updateMetadata(
    file: PatientFile,
    input: {
      name?: string;
      description?: string | null;
      type?: PatientFileType;
      clinicId: string;
      clinicName: string;
      patient: Patient;
    },
  ): Promise<StorageUploadResult> {
    if (!file.driveFileId || !file.storageIntegrationId)
      throw new NotFoundException(
        apiMessage('api.messages.patient_file_is_not_stored_in_drive'),
      );
    const integration = await this.requireIntegration(
      file.storageIntegrationId,
    );
    const drive = await this.drive(integration);
    const current = await drive.files.get({
      fileId: file.driveFileId,
      fields:
        'id,name,mimeType,size,md5Checksum,modifiedTime,headRevisionId,parents,description,appProperties',
    });
    const currentModifiedAt = current.data.modifiedTime
      ? new Date(current.data.modifiedTime)
      : null;
    if (
      !currentModifiedAt ||
      !file.driveModifiedAt ||
      currentModifiedAt.getTime() !== file.driveModifiedAt.getTime()
    ) {
      const externalMetadataJson = appendPatientFileSyncAudit(
        {
          ...file.externalMetadataJson,
          syncConflict: {
            observedDriveModifiedAt: currentModifiedAt?.toISOString() ?? null,
            pendingAppMetadata: {
              ...(input.name !== undefined ? { name: input.name } : {}),
              ...(input.description !== undefined
                ? { description: input.description }
                : {}),
              ...(input.type !== undefined ? { type: input.type } : {}),
            },
          },
        },
        {
          event: 'sync_conflict_detected',
          source: 'app',
          details: {
            observedDriveModifiedAt: currentModifiedAt?.toISOString() ?? null,
            expectedDriveModifiedAt:
              file.driveModifiedAt?.toISOString() ?? null,
          },
        },
      );
      await this.files.save(
        this.files.create({
          ...file,
          syncReviewRequired: true,
          syncReviewReason: 'concurrent_drive_change',
          externalMetadataJson,
        }),
      );
      throw this.error(
        'DRIVE_SYNC_CONFLICT',
        apiMessage(
          'api.messages.this_file_changed_in_google_drive_review_the_drive_version_before_applying',
        ),
      );
    }

    const nextType = input.type ?? file.type;
    const nextCategory = folderForPatientFileType(nextType);
    const clinicFolder = await this.legacyDrive.findOrCreateFolder(
      drive,
      buildClinicRootFolderName(input.clinicId, input.clinicName),
      integration.rootFolderId!,
    );
    const patientsFolder = await this.legacyDrive.findOrCreateFolder(
      drive,
      'patients',
      clinicFolder,
    );
    const patientFolder = await this.legacyDrive.findOrCreateFolder(
      drive,
      buildPatientFolderName(input.patient.id),
      patientsFolder,
    );
    const nextFolder = await this.legacyDrive.findOrCreateFolder(
      drive,
      nextCategory,
      patientFolder,
    );
    const parentIds = current.data.parents ?? [];
    const response = await drive.files.update({
      fileId: file.driveFileId,
      addParents: parentIds.includes(nextFolder) ? undefined : nextFolder,
      removeParents:
        parentIds.filter((parent) => parent !== nextFolder).join(',') ||
        undefined,
      requestBody: {
        name: input.name ?? current.data.name ?? file.storedName,
        description:
          input.description === undefined
            ? (current.data.description ?? undefined)
            : (input.description ?? ''),
        appProperties: {
          ...(current.data.appProperties ?? {}),
          fileId: file.id,
          patientId: input.patient.id,
          tenantId: input.clinicId,
          uploaderUserId: file.uploadedByUserId ?? integration.userId,
          category: nextCategory,
        },
      },
      fields:
        'id,name,mimeType,size,md5Checksum,modifiedTime,parents,description,appProperties',
    });
    const metadata = response.data;
    return {
      storageProvider: StorageProviderType.GOOGLE_DRIVE,
      storageIntegrationId: integration.id,
      uploadedByUserId: file.uploadedByUserId ?? integration.userId,
      storedName: metadata.name ?? file.storedName,
      path: `google-drive://${file.driveFileId}`,
      url: file.url,
      mimeType: metadata.mimeType ?? file.mimeType,
      size: Number(metadata.size ?? file.size),
      driveFileId: file.driveFileId,
      driveFolderId: nextFolder,
      driveModifiedAt: metadata.modifiedTime
        ? new Date(metadata.modifiedTime)
        : null,
      externalMetadataJson: {
        ...file.externalMetadataJson,
        md5Checksum: metadata.md5Checksum ?? null,
        headRevisionId: metadata.headRevisionId ?? null,
      },
    };
  }

  async restore(file: PatientFile): Promise<StorageUploadResult> {
    if (!file.driveFileId || !file.storageIntegrationId)
      throw new NotFoundException(
        apiMessage('api.messages.patient_file_is_not_stored_in_drive'),
      );
    const integration = await this.requireIntegration(
      file.storageIntegrationId,
    );
    const drive = await this.drive(integration);
    let metadata = (
      await drive.files.update({
        fileId: file.driveFileId,
        requestBody: { trashed: false },
        fields:
          'id,name,mimeType,size,md5Checksum,modifiedTime,headRevisionId,parents,description,appProperties',
      })
    ).data;
    if (file.driveFolderId && !metadata.parents?.includes(file.driveFolderId)) {
      metadata = (
        await drive.files.update({
          fileId: file.driveFileId,
          addParents: file.driveFolderId,
          removeParents:
            metadata.parents
              ?.filter((parent) => parent !== file.driveFolderId)
              .join(',') || undefined,
          fields:
            'id,name,mimeType,size,md5Checksum,modifiedTime,headRevisionId,parents,description,appProperties',
        })
      ).data;
    }
    return {
      storageProvider: StorageProviderType.GOOGLE_DRIVE,
      storageIntegrationId: integration.id,
      uploadedByUserId: file.uploadedByUserId ?? integration.userId,
      storedName: metadata.name ?? file.storedName,
      path: `google-drive://${file.driveFileId}`,
      url: file.url,
      mimeType: metadata.mimeType ?? file.mimeType,
      size: Number(metadata.size ?? file.size),
      driveFileId: file.driveFileId,
      driveFolderId: metadata.parents?.[0] ?? file.driveFolderId ?? undefined,
      driveModifiedAt: metadata.modifiedTime
        ? new Date(metadata.modifiedTime)
        : null,
      externalMetadataJson: {
        ...file.externalMetadataJson,
        md5Checksum: metadata.md5Checksum ?? null,
        headRevisionId: metadata.headRevisionId ?? null,
      },
    };
  }

  async listRevisions(file: PatientFile) {
    if (!file.driveFileId || !file.storageIntegrationId)
      throw new NotFoundException(
        apiMessage('api.messages.patient_file_is_not_stored_in_drive'),
      );
    const integration = await this.requireIntegration(
      file.storageIntegrationId,
    );
    const drive = await this.drive(integration);
    const response = await drive.revisions.list({
      fileId: file.driveFileId,
      fields: 'revisions(id,modifiedTime,keepForever,size)',
    });
    return (response.data.revisions ?? []).flatMap((revision) =>
      revision.id
        ? [
            {
              id: revision.id,
              modifiedTime: revision.modifiedTime ?? null,
              keepForever: revision.keepForever ?? false,
              size: revision.size ? Number(revision.size) : null,
            },
          ]
        : [],
    );
  }

  async downloadRevision(file: PatientFile, revisionId: string) {
    if (!file.driveFileId || !file.storageIntegrationId)
      throw new NotFoundException(
        apiMessage('api.messages.patient_file_is_not_stored_in_drive'),
      );
    const integration = await this.requireIntegration(
      file.storageIntegrationId,
    );
    const drive = await this.drive(integration);
    const response = await drive.revisions.get(
      { fileId: file.driveFileId, revisionId, alt: 'media' },
      { responseType: 'stream' },
    );
    return response.data;
  }

  async upload(
    input: StorageUploadInput,
    userId: string,
  ): Promise<StorageUploadResult> {
    const integration = await this.requireUserIntegration(userId);
    return this.withDrive(integration, async (drive) => {
      const clinic = await this.legacyDrive.findOrCreateFolder(
        drive,
        buildClinicRootFolderName(input.clinicId, input.clinicName),
        integration.rootFolderId!,
      );
      const patients = await this.legacyDrive.findOrCreateFolder(
        drive,
        'patients',
        clinic,
      );
      const patient = await this.legacyDrive.findOrCreateFolder(
        drive,
        buildPatientFolderName(input.patient.id),
        patients,
      );
      const category = folderForPatientFileType(input.type);
      const folder = await this.legacyDrive.findOrCreateFolder(
        drive,
        category,
        patient,
      );
      // Recovery after a successful upload followed by a DB/process failure.
      const existing = await drive.files.list({
        q: `trashed = false and '${folder}' in parents and appProperties has { key='fileId' and value='${input.fileId}' }`,
        fields:
          'files(id,name,size,md5Checksum,mimeType,modifiedTime,headRevisionId)',
        pageSize: 2,
      });
      if ((existing.data.files?.length ?? 0) > 1)
        throw this.error(
          'DRIVE_DUPLICATE_FILE',
          apiMessage(
            'api.messages.duplicate_drive_files_need_attention_before_migration_can_continue',
          ),
        );
      const metadata =
        existing.data.files?.[0] ??
        (
          await drive.files.create({
            requestBody: {
              name: buildDriveFileName(
                input.type,
                input.file.originalname,
                input.fileId,
              ),
              description: input.description ?? undefined,
              parents: [folder],
              appProperties: {
                fileId: input.fileId,
                patientId: input.patient.id,
                tenantId: input.clinicId,
                uploaderUserId: userId,
                category,
              },
            },
            media: {
              mimeType: input.file.mimetype,
              body: createReadStream(input.file.path),
            },
            fields:
              'id,name,size,md5Checksum,mimeType,modifiedTime,headRevisionId',
          })
        ).data;
      const content = await fs.readFile(input.file.path);
      if (
        !metadata.id ||
        Number(metadata.size) !== content.length ||
        metadata.md5Checksum !== createHash('md5').update(content).digest('hex')
      )
        throw this.error(
          'DRIVE_UPLOAD_VERIFICATION_FAILED',
          apiMessage(
            'api.messages.drive_upload_could_not_be_verified_retry_the_upload',
          ),
        );
      return {
        storageProvider: StorageProviderType.GOOGLE_DRIVE,
        storageIntegrationId: integration.id,
        uploadedByUserId: userId,
        storedName: metadata.name ?? input.file.originalname,
        path: `google-drive://${metadata.id}`,
        url: `/patient-files/${input.fileId}/download`,
        mimeType: metadata.mimeType ?? input.file.mimetype,
        size: content.length,
        driveFileId: metadata.id,
        driveFolderId: folder,
        driveModifiedAt: metadata.modifiedTime
          ? new Date(metadata.modifiedTime)
          : null,
        externalMetadataJson: {
          md5Checksum: metadata.md5Checksum,
          headRevisionId: metadata.headRevisionId ?? null,
          originalName: input.file.originalname,
        },
      };
    });
  }

  async importFromDrive(
    input: PatientFileDriveImport,
    userId: string,
  ): Promise<StorageUploadResult> {
    const integration = await this.requireUserIntegration(userId);
    const patient = await this.patients.findOne({
      where: { id: input.patientId, clinicId: input.clinicId },
      relations: { clinic: true },
    });
    if (!patient)
      throw new NotFoundException(apiMessage('api.messages.patient_missing'));

    const drive = await this.drive(integration);
    const source = await drive.files.get({
      fileId: input.sourceDriveFileId,
      fields:
        'id,name,mimeType,size,trashed,parents,description,modifiedTime,md5Checksum,headRevisionId,appProperties',
    });
    const alreadyImported = await this.files.findOne({
      where: {
        storageIntegrationId: integration.id,
        driveFileId: input.sourceDriveFileId,
      },
      select: { id: true },
    });
    if (alreadyImported)
      throw this.error(
        'DRIVE_FILE_ALREADY_IMPORTED',
        apiMessage(
          'api.messages.this_drive_file_is_already_attached_to_a_patient_record',
        ),
      );
    const allowedMimeTypes = new Set([
      'application/msword',
      'application/pdf',
      'application/vnd.openxmlformats-officedocument.wordprocessingml.document',
      'image/gif',
      'image/jpeg',
      'image/png',
      'image/webp',
      'text/plain',
    ]);
    if (
      !source.data.id ||
      source.data.trashed ||
      !source.data.mimeType ||
      !allowedMimeTypes.has(source.data.mimeType) ||
      Number(source.data.size ?? 0) > 10 * 1024 * 1024
    ) {
      throw this.error(
        'DRIVE_IMPORT_FILE_UNSUPPORTED',
        apiMessage(
          'api.messages.select_an_untrashed_image_or_document_smaller_than_10_mb',
        ),
      );
    }

    const temporaryDirectory = await fs.mkdtemp(
      path.join(os.tmpdir(), 'dentalhub-drive-import-'),
    );
    const originalName = source.data.name || input.patientFileId;
    const safeName = path.basename(originalName).replace(/[\\/\0]/g, '_');
    const temporaryPath = path.join(temporaryDirectory, safeName);
    try {
      const media = await drive.files.get(
        { fileId: input.sourceDriveFileId, alt: 'media' },
        { responseType: 'stream' },
      );
      let bytesRead = 0;
      const contentHash = createHash('md5');
      const enforceSizeLimit = new Transform({
        transform(chunk: Buffer, _encoding, callback) {
          bytesRead += chunk.length;
          contentHash.update(chunk);
          if (bytesRead > 10 * 1024 * 1024) {
            callback(new Error('Drive import exceeded the file size limit'));
            return;
          }
          callback(null, chunk);
        },
      });
      await pipeline(
        media.data,
        enforceSizeLimit,
        createWriteStream(temporaryPath, { flags: 'wx' }),
      ).catch(() => {
        throw this.error(
          'DRIVE_IMPORT_DOWNLOAD_FAILED',
          apiMessage(
            'api.messages.the_selected_drive_file_could_not_be_imported',
          ),
        );
      });

      if (
        (source.data.size && Number(source.data.size) !== bytesRead) ||
        (source.data.md5Checksum &&
          contentHash.digest('hex') !== source.data.md5Checksum)
      )
        throw this.error(
          'DRIVE_IMPORT_VERIFICATION_FAILED',
          apiMessage(
            'api.messages.the_selected_drive_file_changed_or_failed_integrity_verification_try_importing_it',
          ),
        );

      const file: UploadedFile = {
        originalname: originalName,
        mimetype: source.data.mimeType,
        size: bytesRead,
        destination: temporaryDirectory,
        filename: path.basename(temporaryPath),
        path: temporaryPath,
      };
      await validateAndNormalizeUploadedFile(file, [
        'image',
        'pdf',
        'text',
        'word',
      ]);
      const clinicFolder = await this.legacyDrive.findOrCreateFolder(
        drive,
        buildClinicRootFolderName(input.clinicId, input.clinicName),
        integration.rootFolderId!,
      );
      const patientsFolder = await this.legacyDrive.findOrCreateFolder(
        drive,
        'patients',
        clinicFolder,
      );
      const patientFolder = await this.legacyDrive.findOrCreateFolder(
        drive,
        buildPatientFolderName(patient.id),
        patientsFolder,
      );
      const category = folderForPatientFileType(input.type);
      const targetFolder = await this.legacyDrive.findOrCreateFolder(
        drive,
        category,
        patientFolder,
      );
      const sourceParents = source.data.parents ?? [];
      const sourceAppProperties = source.data.appProperties ?? {};
      const moved = (
        await drive.files.update({
          fileId: input.sourceDriveFileId,
          addParents: sourceParents.includes(targetFolder)
            ? undefined
            : targetFolder,
          removeParents:
            sourceParents
              .filter((parent) => parent !== targetFolder)
              .join(',') || undefined,
          requestBody: {
            description:
              input.description === undefined
                ? (source.data.description ?? undefined)
                : (input.description ?? ''),
            appProperties: {
              ...sourceAppProperties,
              fileId: input.patientFileId,
              patientId: patient.id,
              tenantId: input.clinicId,
              uploaderUserId: userId,
              category,
            },
          },
          fields:
            'id,name,mimeType,size,md5Checksum,modifiedTime,headRevisionId,parents,description,appProperties',
        })
      ).data;
      if (!moved.id)
        throw this.error(
          'DRIVE_IMPORT_MOVE_FAILED',
          apiMessage(
            'api.messages.the_selected_drive_file_could_not_be_moved_into_the_patient_folder',
          ),
        );
      return {
        storageProvider: StorageProviderType.GOOGLE_DRIVE,
        storageIntegrationId: integration.id,
        uploadedByUserId: userId,
        storedName: moved.name ?? originalName,
        path: `google-drive://${moved.id}`,
        url: `/patient-files/${input.patientFileId}/download`,
        mimeType: moved.mimeType ?? source.data.mimeType,
        size: bytesRead,
        driveFileId: moved.id,
        driveFolderId: targetFolder,
        driveModifiedAt: moved.modifiedTime
          ? new Date(moved.modifiedTime)
          : null,
        externalMetadataJson: {
          md5Checksum: moved.md5Checksum ?? null,
          headRevisionId: moved.headRevisionId ?? null,
          originalName,
          driveImportSourceParents: sourceParents,
          driveImportSourceAppProperties: sourceAppProperties,
          driveImportManagedFolderId: targetFolder,
        },
      };
    } finally {
      await fs.rm(temporaryDirectory, { recursive: true, force: true });
    }
  }

  async rollbackImport(result: StorageUploadResult): Promise<void> {
    const driveFileId = result.driveFileId;
    const integrationId = result.storageIntegrationId;
    const metadata = result.externalMetadataJson ?? {};
    const previousParents = metadata.driveImportSourceParents;
    const previousProperties = metadata.driveImportSourceAppProperties;
    const managedFolderId = metadata.driveImportManagedFolderId;
    if (
      !driveFileId ||
      !integrationId ||
      !Array.isArray(previousParents) ||
      typeof managedFolderId !== 'string'
    )
      return;

    const integration = await this.requireIntegration(integrationId);
    const drive = await this.drive(integration);
    await drive.files.update({
      fileId: driveFileId,
      addParents:
        previousParents
          .filter((parent): parent is string => typeof parent === 'string')
          .join(',') || undefined,
      removeParents: managedFolderId,
      requestBody: {
        appProperties:
          previousProperties && typeof previousProperties === 'object'
            ? (previousProperties as Record<string, string>)
            : {},
      },
      fields: 'id',
    });
  }

  async download(file: PatientFile, clinicId: string): Promise<Readable> {
    if (!file.driveFileId)
      throw new NotFoundException(
        apiMessage('api.messages.patient_file_is_unavailable'),
      );
    if (!file.storageIntegrationId) {
      const legacy = await this.legacyIntegrations.findOneBy({
        clinicId,
        provider: StorageProviderType.GOOGLE_DRIVE,
        status: StorageIntegrationStatus.CONNECTED,
      });
      if (!legacy)
        throw this.error(
          'DRIVE_RECONNECT_REQUIRED',
          apiMessage(
            'api.messages.the_original_clinic_drive_connection_is_unavailable',
          ),
        );
      try {
        const drive = await this.legacyDrive.getDrive(legacy);
        return (
          await drive.files.get(
            { fileId: file.driveFileId, alt: 'media' },
            { responseType: 'stream' },
          )
        ).data;
      } catch (error) {
        if (this.statusCode(error) === 404)
          throw new NotFoundException(
            apiMessage('api.messages.this_drive_file_is_unavailable'),
          );
        throw this.error(
          'LEGACY_DRIVE_UNAVAILABLE',
          apiMessage(
            'api.messages.the_original_clinic_drive_connection_is_unavailable_ask_the_clinic_administrator_to',
          ),
        );
      }
    }
    const integration = await this.requireIntegration(
      file.storageIntegrationId,
    );
    return this.withDrive(
      integration,
      async (drive) =>
        (
          await drive.files.get(
            { fileId: file.driveFileId!, alt: 'media' },
            { responseType: 'stream' },
          )
        ).data,
    );
  }

  async trash(integrationId: string, fileId: string) {
    const integration = await this.requireIntegration(integrationId);
    await this.withDrive(integration, async (drive) => {
      await drive.files.update({
        fileId,
        requestBody: { trashed: true },
        fields: 'id',
      });
    });
  }

  async migrationStatus(
    userId: string,
    context: PersonalDriveContext,
  ): Promise<DriveMigrationProgress> {
    const integration = await this.integrations.findOneBy({ userId });
    const candidates = await this.migrationCandidates(userId, context.clinicId);
    const items = integration
      ? await this.migrations
          .createQueryBuilder('item')
          .innerJoin(PatientFile, 'file', 'file.id = item."fileId"')
          .innerJoin(Patient, 'patient', 'patient.id = file."patientId"')
          .where('item."integrationId" = :id', { id: integration.id })
          .andWhere('patient."clinicId" = :clinicId', {
            clinicId: context.clinicId,
          })
          .getMany()
      : [];
    const complete = items.filter((item) => item.status === 'complete').length;
    const failed = items.filter((item) => item.status === 'failed').length;
    const skipped = items.filter((item) => item.status === 'skipped').length;
    const excluded = new Set(
      items
        .filter((item) =>
          ['failed', 'skipped', 'complete'].includes(item.status),
        )
        .map((item) => item.fileId),
    );
    const remaining = candidates.filter(
      (file) => !excluded.has(file.id),
    ).length;
    // Count unassigned records without exposing their names or patient details.
    const unassigned = this.access.canViewAllPatients(this.context(context))
      ? await this.files
          .createQueryBuilder('file')
          .innerJoin('file.patient', 'patient')
          .where('patient.clinicId = :clinicId', { clinicId: context.clinicId })
          .andWhere('file."uploadedByUserId" IS NULL')
          .andWhere('file."storageIntegrationId" IS NULL')
          .getCount()
      : 0;
    return {
      total: complete + candidates.length,
      migrated: complete,
      failed,
      skipped,
      unassigned,
      remaining,
      hasMore: remaining > 0,
    };
  }

  async migrate(
    userId: string,
    context: PersonalDriveContext,
    retry: boolean,
  ): Promise<DriveMigrationProgress> {
    const integration = await this.requireUserIntegration(userId);
    const candidates = await this.migrationCandidates(userId, context.clinicId);
    let attempted = 0;
    for (const file of candidates) {
      if (attempted >= 10) break;
      await this.migrations
        .createQueryBuilder()
        .insert()
        .values({
          integrationId: integration.id,
          fileId: file.id,
          status: 'pending',
        })
        .orIgnore()
        .execute();
      const now = new Date();
      const claim = await this.migrations
        .createQueryBuilder()
        .update(DriveMigrationItem)
        .set({
          status: 'running',
          leaseUntil: new Date(now.getTime() + 600_000),
          error: null,
        })
        .where('"integrationId" = :id AND "fileId" = :fileId', {
          id: integration.id,
          fileId: file.id,
        })
        .andWhere(
          '(status = :pending OR (status = :running AND "leaseUntil" < :now) OR (:retry = true AND status IN (:...retryStatuses)))',
          {
            pending: 'pending',
            running: 'running',
            now,
            retry,
            retryStatuses: ['failed', 'skipped'],
          },
        )
        .execute();
      if (!claim.affected) continue;
      attempted++;
      let patientAccessAvailable: boolean;
      try {
        await this.access.assertPatientAccessible(
          this.context(context),
          file.patientId,
        );
        patientAccessAvailable =
          this.access.canManageClinical(this.context(context)) ||
          (file.type === PatientFileType.PROFILE_PHOTO &&
            this.access.canManagePatients(this.context(context)));
      } catch {
        patientAccessAvailable = false;
      }
      if (!patientAccessAvailable) {
        await this.finishMigration(
          integration.id,
          file.id,
          'skipped',
          'Patient access is unavailable.',
        );
        continue;
      }

      const directory = path.resolve(process.cwd(), 'uploads', 'patient-files');
      const localSource = path.resolve(directory, file.storedName);
      if (
        file.storageProvider === StorageProviderType.LOCAL &&
        !localSource.startsWith(directory + path.sep)
      ) {
        await this.finishMigration(
          integration.id,
          file.id,
          'failed',
          'The file could not be migrated. The original reference was retained.',
        );
        continue;
      }

      let temporary: string | undefined;
      try {
        let source = file.path;
        if (file.storageProvider === StorageProviderType.GOOGLE_DRIVE) {
          temporary = await fs.mkdtemp(
            path.join(os.tmpdir(), 'dental-drive-migrate-'),
          );
          source = path.join(temporary, 'source');
          const stream = await this.download(file, context.clinicId);
          const { createWriteStream } = await import('fs');
          await pipeline(stream, createWriteStream(source));
        } else {
          source = localSource;
        }
        const content = await fs.readFile(source);
        const checksum = createHash('sha256').update(content).digest('hex');
        if (file.checksum && file.checksum !== checksum) {
          await this.finishMigration(
            integration.id,
            file.id,
            'failed',
            'The file could not be migrated. The original reference was retained.',
          );
          continue;
        }
        const result = await this.upload(
          {
            clinicId: context.clinicId,
            clinicName: file.patient.clinic.name,
            patient: file.patient,
            fileId: file.id,
            file: {
              originalname: file.originalName,
              mimetype: file.mimeType,
              size: content.length,
              destination: path.dirname(source),
              filename: path.basename(source),
              path: source,
            },
            type: file.type,
            checksum,
            baseUrl: '',
            uploadedByMembershipId: file.uploadedByMembershipId!,
            relation: {
              appointmentId: file.appointmentId,
              treatmentId: file.treatmentId,
              clinicalNoteId: file.clinicalNoteId,
            },
          },
          userId,
        );
        await this.files.manager.transaction(async (manager) => {
          const update = await manager
            .getRepository(PatientFile)
            .createQueryBuilder()
            .update(PatientFile)
            .set({
              ...result,
              externalMetadataJson: () => ':metadata',
              checksum,
              storageStatus: PatientFileStorageStatus.AVAILABLE,
            })
            .setParameter(
              'metadata',
              JSON.stringify(result.externalMetadataJson ?? {}),
            )
            .where(
              'id = :id AND "storageIntegrationId" IS NULL AND "deletedAt" IS NULL',
              {
                id: file.id,
              },
            )
            .execute();
          if (update.affected !== 1)
            throw new Error('File was changed during migration');
          await manager
            .getRepository(Patient)
            .update(
              { profilePhotoFileId: file.id },
              { profilePhotoUrl: result.url },
            );
          await manager
            .getRepository(DriveMigrationItem)
            .update(
              { integrationId: integration.id, fileId: file.id },
              { status: 'complete', error: null, leaseUntil: null },
            );
        });
        if (file.storageProvider === StorageProviderType.LOCAL)
          await fs.unlink(source).catch(() => undefined);
      } catch {
        await this.finishMigration(
          integration.id,
          file.id,
          'failed',
          'The file could not be migrated. The original reference was retained.',
        );
      } finally {
        if (temporary) await fs.rm(temporary, { recursive: true, force: true });
      }
    }
    return this.migrationStatus(userId, context);
  }

  async sync(userId: string, context: PersonalDriveContext) {
    const integration = await this.requireUserIntegration(userId);
    return {
      provider: 'google_drive' as const,
      ...(await this.syncIntegration(
        integration,
        undefined,
        context.clinicId,
        false,
      )),
    };
  }

  async syncConnectedIntegrations(): Promise<void> {
    const integrations = await this.integrations
      .createQueryBuilder('integration')
      .addSelect([
        'integration.encryptedAccessToken',
        'integration.encryptedRefreshToken',
      ])
      .where('integration.status = :status', {
        status: StorageIntegrationStatus.CONNECTED,
      })
      .getMany();

    for (const integration of integrations) {
      try {
        const drive = await this.drive(integration);
        await this.ensureChangeWatch(integration, drive);
        await this.syncIntegration(integration, drive);
      } catch {
        // A later worker tick retries this integration without exposing Drive data.
      }
    }
  }

  async handleDriveNotification(
    channelId: string,
    channelToken: string,
  ): Promise<boolean> {
    const integration = await this.integrations
      .createQueryBuilder('integration')
      .addSelect([
        'integration.encryptedAccessToken',
        'integration.encryptedRefreshToken',
        'integration.driveWatchTokenHash',
      ])
      .where('integration.driveWatchChannelId = :channelId', { channelId })
      .andWhere('integration.status = :status', {
        status: StorageIntegrationStatus.CONNECTED,
      })
      .getOne();

    if (!integration?.driveWatchTokenHash) return false;
    const receivedHash = createHash('sha256').update(channelToken).digest();
    const expectedHash = Buffer.from(integration.driveWatchTokenHash, 'hex');
    if (
      expectedHash.length !== receivedHash.length ||
      !timingSafeEqual(receivedHash, expectedHash)
    )
      return false;

    const drive = await this.drive(integration);
    await this.syncIntegration(integration, drive);
    return true;
  }

  private async syncIntegration(
    integration: UserStorageIntegration,
    existingDrive?: drive_v3.Drive,
    clinicId?: string,
    advanceCursor = true,
  ) {
    while (this.integrationSyncLocks.has(integration.id))
      await this.integrationSyncLocks.get(integration.id);

    let release!: () => void;
    const lock = new Promise<void>((resolve) => {
      release = resolve;
    });
    this.integrationSyncLocks.set(integration.id, lock);
    try {
      return await this.syncIntegrationUnlocked(
        integration,
        existingDrive,
        clinicId,
        advanceCursor,
      );
    } finally {
      if (this.integrationSyncLocks.get(integration.id) === lock)
        this.integrationSyncLocks.delete(integration.id);
      release();
    }
  }

  private async syncIntegrationUnlocked(
    integration: UserStorageIntegration,
    existingDrive?: drive_v3.Drive,
    clinicId?: string,
    advanceCursor = true,
  ) {
    const drive = existingDrive ?? (await this.drive(integration));
    if (!integration.driveStartPageToken) {
      const startToken = await drive.changes.getStartPageToken({
        fields: 'startPageToken',
      });
      if (advanceCursor) {
        integration.driveStartPageToken =
          startToken.data.startPageToken ?? null;
        await this.integrations.save(integration);
      }
      return this.reconcileKnownFiles(integration, drive, clinicId);
    }

    let pageToken: string | undefined = integration.driveStartPageToken;
    let scanned = 0;
    let updated = 0;
    let unavailable = 0;
    while (pageToken) {
      let response: { data: drive_v3.Schema$ChangeList };
      try {
        response = await drive.changes.list({
          pageToken,
          spaces: 'drive',
          fields:
            'nextPageToken,newStartPageToken,changes(fileId,removed,file(id,name,mimeType,size,md5Checksum,modifiedTime,headRevisionId,trashed,parents,description,appProperties))',
        });
      } catch (error) {
        if (this.statusCode(error) !== 410) throw error;
        const startToken = await drive.changes.getStartPageToken({
          fields: 'startPageToken',
        });
        if (advanceCursor) {
          integration.driveStartPageToken =
            startToken.data.startPageToken ?? null;
          await this.integrations.save(integration);
        }
        const reconciled = await this.reconcileKnownFiles(
          integration,
          drive,
          clinicId,
        );
        return { ...reconciled, scanned: reconciled.scanned + scanned };
      }

      for (const change of response.data.changes ?? []) {
        const result = await this.applyDriveChange(
          integration,
          drive,
          change,
          clinicId,
        );
        scanned += result.scanned;
        updated += result.updated;
        unavailable += result.unavailable;
      }

      pageToken = response.data.nextPageToken ?? undefined;
      if (advanceCursor) {
        integration.driveStartPageToken =
          response.data.newStartPageToken ??
          pageToken ??
          integration.driveStartPageToken;
        await this.integrations.save(integration);
      }
    }

    const syncedAt = new Date().toISOString();
    integration.metadataJson = advanceCursor
      ? { ...integration.metadataJson, lastSyncAt: syncedAt }
      : {
          ...integration.metadataJson,
          clinicSyncAt: {
            ...(typeof integration.metadataJson.clinicSyncAt === 'object' &&
            integration.metadataJson.clinicSyncAt !== null
              ? integration.metadataJson.clinicSyncAt
              : {}),
            [clinicId ?? 'unknown']: syncedAt,
          },
        };
    await this.integrations.save(integration);
    return { scanned, updated, unavailable };
  }

  private async applyDriveChange(
    integration: UserStorageIntegration,
    drive: drive_v3.Drive,
    change: drive_v3.Schema$Change,
    clinicId?: string,
  ) {
    if (!change.fileId) return { scanned: 0, updated: 0, unavailable: 0 };
    const file = await this.files.findOne({
      where: {
        storageIntegrationId: integration.id,
        driveFileId: change.fileId,
        ...(clinicId ? { patient: { clinicId } } : {}),
      },
    });
    if (!file) return { scanned: 0, updated: 0, unavailable: 0 };

    if (change.removed || change.file?.trashed) {
      if (
        file.storageStatus === PatientFileStorageStatus.UNAVAILABLE &&
        file.syncSource === PatientFileSyncSource.APP
      )
        return { scanned: 1, updated: 0, unavailable: 1 };
      const externalMetadataJson = appendPatientFileSyncAudit(
        file.externalMetadataJson,
        {
          event: 'drive_file_unavailable',
          source: 'drive',
          details: {
            driveFileId: file.driveFileId,
            reason: change.removed ? 'removed' : 'trashed',
            lastKnownName: file.storedName,
            lastKnownHeadRevisionId:
              file.externalMetadataJson?.headRevisionId ?? null,
          },
        },
      );
      await this.files.save(
        this.files.create({
          ...file,
          storageStatus: PatientFileStorageStatus.UNAVAILABLE,
          syncSource: PatientFileSyncSource.DRIVE_UPDATE,
          syncReviewRequired: true,
          syncReviewReason: 'drive_file_removed',
          externalMetadataJson,
        }),
      );
      return { scanned: 1, updated: 0, unavailable: 1 };
    }

    const metadata = change.file?.id
      ? change.file
      : (
          await drive.files.get({
            fileId: change.fileId,
            fields:
              'id,name,mimeType,size,md5Checksum,modifiedTime,headRevisionId,trashed,parents,description,appProperties',
          })
        ).data;
    const appProperties = metadata.appProperties ?? {};
    const patient = await this.patients.findOneBy({ id: file.patientId });
    const associationChanged =
      (appProperties.fileId && appProperties.fileId !== file.id) ||
      (appProperties.patientId && appProperties.patientId !== file.patientId) ||
      (appProperties.tenantId && appProperties.tenantId !== patient?.clinicId);
    const managedFolder = patient
      ? await this.managedPatientFolder(
          integration,
          drive,
          file.patientId,
          patient.clinicId,
          metadata.parents ?? [],
        )
      : null;
    if (associationChanged || !managedFolder) {
      const reason = associationChanged
        ? 'drive_file_association_changed'
        : 'drive_file_moved_from_managed_folder';
      const externalMetadataJson = appendPatientFileSyncAudit(
        file.externalMetadataJson,
        {
          event: 'drive_file_review_required',
          source: 'drive',
          details: {
            reason,
            driveFileId: file.driveFileId,
            parents: metadata.parents ?? [],
            appProperties,
          },
        },
      );
      await this.files.save(
        this.files.create({
          ...file,
          storageStatus: managedFolder
            ? file.storageStatus
            : PatientFileStorageStatus.UNAVAILABLE,
          syncSource: PatientFileSyncSource.DRIVE_UPDATE,
          syncReviewRequired: true,
          syncReviewReason: reason,
          externalMetadataJson,
        }),
      );
      return {
        scanned: 1,
        updated: 0,
        unavailable: managedFolder ? 0 : 1,
      };
    }
    const before = {
      name: file.storedName,
      description: file.description,
      type: file.type,
      size: file.size,
      md5Checksum: file.externalMetadataJson?.md5Checksum ?? null,
      headRevisionId: file.externalMetadataJson?.headRevisionId ?? null,
      driveModifiedAt: file.driveModifiedAt?.toISOString() ?? null,
    };
    const after = {
      name: metadata.name ?? file.storedName,
      description: metadata.description ?? file.description,
      type:
        managedFolder?.type === PatientFileType.DOCUMENT &&
        file.type === PatientFileType.PDF
          ? PatientFileType.PDF
          : (managedFolder?.type ?? file.type),
      size: Number(metadata.size ?? file.size),
      md5Checksum: metadata.md5Checksum ?? null,
      headRevisionId: metadata.headRevisionId ?? null,
      driveModifiedAt: metadata.modifiedTime ?? null,
    };
    const changed = Object.keys(before).some(
      (key) =>
        before[key as keyof typeof before] !== after[key as keyof typeof after],
    );
    let externalMetadataJson: Record<string, unknown> = {
      ...file.externalMetadataJson,
      md5Checksum: metadata.md5Checksum ?? null,
      headRevisionId: metadata.headRevisionId ?? null,
    };
    if (changed) {
      const previousVersions = Array.isArray(
        file.externalMetadataJson?.driveVersionHistory,
      )
        ? file.externalMetadataJson.driveVersionHistory.filter(
            (item): item is Record<string, unknown> =>
              typeof item === 'object' && item !== null,
          )
        : [];
      const contentChanged =
        Boolean(file.externalMetadataJson?.md5Checksum) &&
        Boolean(metadata.md5Checksum) &&
        file.externalMetadataJson.md5Checksum !== metadata.md5Checksum;
      if (contentChanged) {
        externalMetadataJson = {
          ...externalMetadataJson,
          driveVersionHistory: [
            ...previousVersions,
            {
              revisionId: file.externalMetadataJson?.headRevisionId ?? null,
              md5Checksum: file.externalMetadataJson?.md5Checksum ?? null,
              modifiedAt: file.driveModifiedAt?.toISOString() ?? null,
              name: file.storedName,
              size: file.size,
            },
          ].slice(-50),
        };
      }
      externalMetadataJson = appendPatientFileSyncAudit(externalMetadataJson, {
        event: 'drive_file_changed',
        source: 'drive',
        details: { before, after },
      });
    }
    const pendingReview = file.syncReviewRequired;
    await this.files.save(
      this.files.create({
        ...file,
        originalName: metadata.name ?? file.originalName,
        storedName: metadata.name ?? file.storedName,
        description: metadata.description ?? file.description,
        type: after.type,
        size: Number(metadata.size ?? file.size),
        mimeType: metadata.mimeType ?? file.mimeType,
        driveModifiedAt: metadata.modifiedTime
          ? new Date(metadata.modifiedTime)
          : file.driveModifiedAt,
        storageStatus: metadata.trashed
          ? PatientFileStorageStatus.UNAVAILABLE
          : PatientFileStorageStatus.AVAILABLE,
        syncSource: PatientFileSyncSource.DRIVE_UPDATE,
        syncReviewRequired: pendingReview || Boolean(metadata.trashed),
        syncReviewReason: file.syncReviewReason,
        driveFolderId: managedFolder?.folderId ?? file.driveFolderId,
        externalMetadataJson,
      }),
    );
    return {
      scanned: 1,
      updated: 1,
      unavailable: metadata.trashed ? 1 : 0,
    };
  }

  private async managedPatientFolder(
    integration: UserStorageIntegration,
    drive: drive_v3.Drive,
    patientId: string,
    clinicId: string,
    possibleCategoryFolderIds: string[],
  ): Promise<{ folderId: string; type: PatientFileType } | null> {
    for (const folderId of possibleCategoryFolderIds) {
      const categoryFolder = await drive.files
        .get({ fileId: folderId, fields: 'id,name,mimeType,parents' })
        .then((response) => response.data)
        .catch(() => null);
      const categoryName = categoryFolder?.name;
      if (
        !categoryFolder ||
        !categoryName ||
        ![
          'avatar',
          'radiographs',
          'clinical-images',
          'documents',
          'misc',
        ].includes(categoryName)
      )
        continue;
      const patientFolderId = categoryFolder.parents?.[0];
      if (!patientFolderId) continue;
      const patientFolder = await drive.files
        .get({ fileId: patientFolderId, fields: 'id,name,parents' })
        .then((response) => response.data)
        .catch(() => null);
      if (
        patientFolder?.name !== buildPatientFolderName(patientId) ||
        !patientFolder.parents?.[0]
      )
        continue;
      const patientsFolder = await drive.files
        .get({ fileId: patientFolder.parents[0], fields: 'id,name,parents' })
        .then((response) => response.data)
        .catch(() => null);
      if (patientsFolder?.name !== 'patients' || !patientsFolder.parents?.[0])
        continue;
      const clinicFolder = await drive.files
        .get({ fileId: patientsFolder.parents[0], fields: 'id,name,parents' })
        .then((response) => response.data)
        .catch(() => null);
      if (
        !clinicFolder?.parents?.includes(integration.rootFolderId ?? '') ||
        !clinicFolder.name?.startsWith(
          `DentalHub__tenant-${shortId(clinicId)}__`,
        )
      )
        continue;
      return {
        folderId,
        type: patientFileTypeFromDriveFolder(categoryName),
      };
    }
    return null;
  }

  private async reconcileKnownFiles(
    integration: UserStorageIntegration,
    drive: drive_v3.Drive,
    clinicId?: string,
  ) {
    const files = await this.files.find({
      where: {
        storageIntegrationId: integration.id,
        ...(clinicId ? { patient: { clinicId } } : {}),
      },
    });
    let updated = 0;
    let unavailable = 0;
    for (const file of files) {
      if (!file.driveFileId) continue;
      try {
        const metadata = await drive.files.get({
          fileId: file.driveFileId,
          fields:
            'id,name,mimeType,size,md5Checksum,modifiedTime,headRevisionId,trashed,parents,description,appProperties',
        });
        const result = await this.applyDriveChange(
          integration,
          drive,
          {
            fileId: file.driveFileId,
            file: metadata.data,
          },
          clinicId,
        );
        updated += result.updated;
        unavailable += result.unavailable;
      } catch (error) {
        if (this.statusCode(error) !== 404) throw error;
        await this.files.save(
          this.files.create({
            ...file,
            storageStatus: PatientFileStorageStatus.UNAVAILABLE,
            syncSource: PatientFileSyncSource.DRIVE_UPDATE,
            syncReviewRequired: true,
            syncReviewReason: 'drive_file_removed',
            externalMetadataJson: appendPatientFileSyncAudit(
              file.externalMetadataJson,
              {
                event: 'drive_file_unavailable',
                source: 'drive',
                details: {
                  driveFileId: file.driveFileId,
                  reason: 'not_found',
                  lastKnownName: file.storedName,
                  lastKnownHeadRevisionId:
                    file.externalMetadataJson?.headRevisionId ?? null,
                },
              },
            ),
          }),
        );
        unavailable++;
      }
    }
    return { scanned: files.length, updated, unavailable };
  }

  private async ensureChangeWatch(
    integration: UserStorageIntegration,
    drive: drive_v3.Drive,
  ) {
    const address = getEnv('GOOGLE_DRIVE_WEBHOOK_URL');
    if (!address || !integration.driveStartPageToken) return;
    if (
      integration.driveWatchChannelId &&
      integration.driveWatchExpiresAt &&
      integration.driveWatchExpiresAt.getTime() > Date.now() + 60 * 60 * 1000
    )
      return;

    const channelId = randomBytes(16).toString('hex');
    const channelToken = randomBytes(32).toString('base64url');
    const requestedExpiration = Date.now() + 24 * 60 * 60 * 1000;
    const response = await drive.changes.watch({
      pageToken: integration.driveStartPageToken,
      requestBody: {
        id: channelId,
        type: 'web_hook',
        address,
        token: channelToken,
        expiration: String(requestedExpiration),
      },
    });
    integration.driveWatchChannelId = channelId;
    integration.driveWatchResourceId = response.data.resourceId ?? null;
    integration.driveWatchTokenHash = createHash('sha256')
      .update(channelToken)
      .digest('hex');
    integration.driveWatchExpiresAt = response.data.expiration
      ? new Date(Number(response.data.expiration))
      : new Date(requestedExpiration);
    await this.integrations.save(integration);
  }

  private migrationCandidates(userId: string, clinicId: string) {
    return this.files.find({
      where: {
        uploadedByUserId: userId,
        storageIntegrationId: IsNull(),
        storageStatus: PatientFileStorageStatus.AVAILABLE,
        patient: { clinicId },
      },
      relations: { patient: { clinic: true } },
      order: { createdAt: 'ASC' },
    });
  }
  private finishMigration(
    integrationId: string,
    fileId: string,
    status: 'failed' | 'skipped',
    error: string,
  ) {
    return this.migrations.update(
      { integrationId, fileId },
      { status, error, leaseUntil: null },
    );
  }
  private context(value: PersonalDriveContext): ClinicAccessContext {
    return { ...value, role: value.role as ClinicMembershipRole };
  }
  private credentialsByUser(userId: string) {
    return this.integrations
      .createQueryBuilder('integration')
      .addSelect([
        'integration.encryptedAccessToken',
        'integration.encryptedRefreshToken',
      ])
      .where('integration.userId = :userId', { userId })
      .getOne();
  }
  private async requireUserIntegration(userId: string) {
    const integration = await this.credentialsByUser(userId);
    if (
      !integration ||
      integration.status !== StorageIntegrationStatus.CONNECTED ||
      !integration.encryptedRefreshToken
    )
      throw this.error(
        'DRIVE_CONNECTION_REQUIRED',
        apiMessage(
          'api.messages.connect_your_google_drive_before_uploading_patient_files',
        ),
      );
    return integration;
  }
  private async requireIntegration(id: string) {
    const integration = await this.integrations
      .createQueryBuilder('integration')
      .addSelect([
        'integration.encryptedAccessToken',
        'integration.encryptedRefreshToken',
      ])
      .innerJoin('integration.user', 'owner')
      .where('integration.id = :id', { id })
      .andWhere('owner.isActive = true')
      .getOne();
    if (
      !integration ||
      integration.status !== StorageIntegrationStatus.CONNECTED ||
      !integration.encryptedRefreshToken
    )
      throw this.error(
        'DRIVE_RECONNECT_REQUIRED',
        apiMessage(
          'api.messages.the_file_owner_needs_to_reconnect_google_drive',
        ),
      );
    return integration;
  }
  private async drive(integration: UserStorageIntegration) {
    const client = this.oauth();
    client.setCredentials({
      access_token: integration.encryptedAccessToken
        ? this.tokens.decrypt(integration.encryptedAccessToken)
        : undefined,
      refresh_token: integration.encryptedRefreshToken
        ? this.tokens.decrypt(integration.encryptedRefreshToken)
        : undefined,
      expiry_date: integration.tokenExpiresAt?.getTime(),
    });
    // Await refresh persistence before returning an API client; don't create unhandled promises in an SDK event listener.
    await client.getAccessToken();
    if (integration.id && client.credentials.access_token) {
      integration.encryptedAccessToken = this.tokens.encrypt(
        client.credentials.access_token,
      );
      integration.tokenExpiresAt = client.credentials.expiry_date
        ? new Date(client.credentials.expiry_date)
        : null;
      await this.integrations.update(integration.id, {
        encryptedAccessToken: integration.encryptedAccessToken,
        tokenExpiresAt: integration.tokenExpiresAt,
      });
    }
    return google.drive({ version: 'v3', auth: client });
  }
  private async withDrive<T>(
    integration: UserStorageIntegration,
    action: (drive: drive_v3.Drive) => Promise<T>,
  ): Promise<T> {
    try {
      return await action(await this.drive(integration));
    } catch (error) {
      if (
        error instanceof ConflictException ||
        error instanceof NotFoundException
      )
        throw error;
      const status = this.statusCode(error);
      const data =
        typeof error === 'object' && error !== null && 'response' in error
          ? JSON.stringify(
              (error as { response?: { data?: unknown } }).response?.data ?? {},
            )
          : '';
      if (status === 401 || data.includes('invalid_grant')) {
        await this.integrations.update(integration.id, {
          status: StorageIntegrationStatus.ERROR,
        });
        throw this.error(
          'DRIVE_RECONNECT_REQUIRED',
          apiMessage(
            'api.messages.the_file_owner_needs_to_reconnect_google_drive',
          ),
        );
      }
      if (status === 404)
        throw new NotFoundException(
          apiMessage('api.messages.this_drive_file_is_unavailable'),
        );
      if (status === 403)
        throw this.error(
          'DRIVE_ACCESS_DENIED',
          apiMessage(
            'api.messages.drive_access_or_storage_quota_is_unavailable_check_your_google_account_and',
          ),
        );
      throw this.error(
        'DRIVE_UNAVAILABLE',
        apiMessage(
          'api.messages.google_drive_is_temporarily_unavailable_retry_when_your_connection_is_restored',
        ),
      );
    }
  }
  private statusCode(error: unknown): number | undefined {
    if (typeof error !== 'object' || error === null) return undefined;
    const value = error as {
      code?: string | number;
      response?: { status?: number };
    };
    return (
      value.response?.status ??
      (typeof value.code === 'number' ? value.code : undefined)
    );
  }
  private error(code: string, message: ApiMessage) {
    return new ConflictException({ code, message });
  }
}
