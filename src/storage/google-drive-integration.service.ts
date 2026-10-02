import {
  BadRequestException,
  Injectable,
  NotFoundException,
} from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { drive_v3 } from 'googleapis';
import { Repository } from 'typeorm';

import { Clinic } from '../clinics/entities/clinic.entity';
import { Patient } from '../patients/entities/patient.entity';
import { PatientFile } from '../patient-files/entities/patient-file.entity';
import { PatientFileStorageStatus } from '../patient-files/interfaces/patient-file-storage-status.enum';
import { PatientFileSyncSource } from '../patient-files/interfaces/patient-file-sync-source.enum';
import { ClinicStorageIntegration } from './entities/clinic-storage-integration.entity';
import { StorageIntegrationStatus } from './interfaces/storage-integration-status.enum';
import { StorageProviderType } from './interfaces/storage-provider-type.enum';
import { GoogleDriveStorageProvider } from './providers/google-drive-storage.provider';
import { TokenEncryptionService } from './token-encryption.service';
import {
  DRIVE_FOLDER_MIME_TYPE,
  isKnownPatientFolderName,
  patientFileTypeFromDriveFolder,
  PATIENT_DRIVE_FOLDERS,
  shortId,
} from './utils/drive-naming.util';

interface DriveFileSnapshot {
  id: string;
  name: string;
  mimeType: string;
  size: number;
  md5Checksum: string | null;
  modifiedTime: Date | null;
  webViewLink: string | null;
  webContentLink: string | null;
  parents: string[];
  appProperties: Record<string, string>;
}

@Injectable()
export class GoogleDriveIntegrationService {
  constructor(
    @InjectRepository(ClinicStorageIntegration)
    private readonly integrationRepository: Repository<ClinicStorageIntegration>,
    @InjectRepository(Clinic)
    private readonly clinicRepository: Repository<Clinic>,
    @InjectRepository(Patient)
    private readonly patientRepository: Repository<Patient>,
    @InjectRepository(PatientFile)
    private readonly patientFileRepository: Repository<PatientFile>,
    private readonly googleDriveStorageProvider: GoogleDriveStorageProvider,
    private readonly tokenEncryption: TokenEncryptionService,
  ) {}

  async getStatus(clinicId: string) {
    const integration = await this.integrationRepository.findOne({
      where: { clinicId, provider: StorageProviderType.GOOGLE_DRIVE },
    });

    return {
      provider: StorageProviderType.GOOGLE_DRIVE,
      status: integration?.status ?? StorageIntegrationStatus.DISCONNECTED,
      connected: integration?.status === StorageIntegrationStatus.CONNECTED,
      rootFolderId: integration?.rootFolderId ?? null,
      patientsFolderId: integration?.patientsFolderId ?? null,
      tokenExpiresAt: integration?.tokenExpiresAt ?? null,
      driveStartPageToken: integration?.driveStartPageToken
        ? 'configured'
        : null,
      metadataJson: integration?.metadataJson ?? {},
    };
  }

  buildOAuthUrl(clinicId: string, redirectUri?: string) {
    if (!redirectUri) {
      throw new BadRequestException('redirectUri query param is required');
    }

    return {
      url: this.googleDriveStorageProvider.buildAuthUrl(redirectUri, clinicId),
      scope: 'https://www.googleapis.com/auth/drive.file',
    };
  }

  async connect(clinicId: string, code: string, redirectUri: string) {
    const clinic = await this.getClinic(clinicId);
    const tokens = await this.googleDriveStorageProvider.exchangeCode(
      code,
      redirectUri,
    );
    const existing = await this.integrationRepository.findOne({
      where: { clinicId, provider: StorageProviderType.GOOGLE_DRIVE },
    });
    const integration =
      existing ??
      this.integrationRepository.create({
        clinicId,
        provider: StorageProviderType.GOOGLE_DRIVE,
      });

    integration.status = StorageIntegrationStatus.CONNECTED;
    integration.encryptedAccessToken = tokens.access_token
      ? this.tokenEncryption.encrypt(tokens.access_token)
      : integration.encryptedAccessToken;
    integration.encryptedRefreshToken = tokens.refresh_token
      ? this.tokenEncryption.encrypt(tokens.refresh_token)
      : integration.encryptedRefreshToken;
    integration.tokenExpiresAt = tokens.expiry_date
      ? new Date(tokens.expiry_date)
      : null;
    integration.metadataJson = {
      ...(integration.metadataJson ?? {}),
      scope: tokens.scope,
      tokenType: tokens.token_type,
      connectedAt: new Date().toISOString(),
    };

    let saved = await this.integrationRepository.save(integration);
    const folders = await this.googleDriveStorageProvider.ensureClinicFolders(
      saved,
      clinic.name,
    );
    saved.rootFolderId = folders.rootFolderId;
    saved.patientsFolderId = folders.patientsFolderId;

    const drive = await this.googleDriveStorageProvider.getDrive(saved);
    const startToken = await drive.changes.getStartPageToken({
      fields: 'startPageToken',
    });
    saved.driveStartPageToken = startToken.data.startPageToken ?? null;
    saved = await this.integrationRepository.save(saved);

    return this.toPublicIntegration(saved);
  }

  async disconnect(clinicId: string) {
    const integration = await this.integrationRepository.findOne({
      where: { clinicId, provider: StorageProviderType.GOOGLE_DRIVE },
    });

    if (!integration) {
      return { message: 'Google Drive integration already disconnected' };
    }

    integration.status = StorageIntegrationStatus.DISCONNECTED;
    integration.encryptedAccessToken = null;
    integration.encryptedRefreshToken = null;
    integration.tokenExpiresAt = null;
    integration.driveStartPageToken = null;
    integration.metadataJson = {
      ...(integration.metadataJson ?? {}),
      disconnectedAt: new Date().toISOString(),
    };
    await this.integrationRepository.save(integration);

    return { message: 'Google Drive integration disconnected' };
  }

  async sync(clinicId: string) {
    const clinic = await this.getClinic(clinicId);
    const integration = await this.integrationRepository.findOne({
      where: {
        clinicId,
        provider: StorageProviderType.GOOGLE_DRIVE,
        status: StorageIntegrationStatus.CONNECTED,
      },
    });

    if (!integration) {
      throw new BadRequestException(
        'Google Drive integration is not connected',
      );
    }

    const folders = await this.googleDriveStorageProvider.ensureClinicFolders(
      integration,
      clinic.name,
    );
    integration.rootFolderId = folders.rootFolderId;
    integration.patientsFolderId = folders.patientsFolderId;

    const drive = await this.googleDriveStorageProvider.getDrive(integration);
    const unavailableCount = await this.applyDriveChanges(drive, integration);
    const scanResult = await this.scanKnownPatientFolders(drive, integration);

    if (!integration.driveStartPageToken) {
      const startToken = await drive.changes.getStartPageToken({
        fields: 'startPageToken',
      });
      integration.driveStartPageToken = startToken.data.startPageToken ?? null;
    }

    integration.metadataJson = {
      ...(integration.metadataJson ?? {}),
      lastSyncAt: new Date().toISOString(),
      lastSyncResult: {
        ...scanResult,
        unavailable: unavailableCount,
      },
    };
    await this.integrationRepository.save(integration);

    return {
      provider: StorageProviderType.GOOGLE_DRIVE,
      ...scanResult,
      unavailable: unavailableCount,
    };
  }

  private async applyDriveChanges(
    drive: drive_v3.Drive,
    integration: ClinicStorageIntegration,
  ): Promise<number> {
    if (!integration.driveStartPageToken) return 0;

    let pageToken: string | undefined = integration.driveStartPageToken;
    let unavailableCount = 0;

    while (pageToken) {
      const response: { data: drive_v3.Schema$ChangeList } =
        await drive.changes.list({
          pageToken,
          spaces: 'drive',
          fields:
            'newStartPageToken,nextPageToken,changes(removed,fileId,file(id,trashed))',
        });

      for (const change of response.data.changes ?? []) {
        if (!change.fileId) continue;

        if (change.removed || change.file?.trashed) {
          const update = await this.patientFileRepository.update(
            {
              driveFileId: change.fileId,
              storageProvider: StorageProviderType.GOOGLE_DRIVE,
            },
            {
              storageStatus: PatientFileStorageStatus.UNAVAILABLE,
              syncSource: PatientFileSyncSource.DRIVE_UPDATE,
            },
          );
          unavailableCount += update.affected ?? 0;
        }
      }

      if (response.data.newStartPageToken) {
        integration.driveStartPageToken = response.data.newStartPageToken;
      }
      pageToken = response.data.nextPageToken ?? undefined;
    }

    return unavailableCount;
  }

  private async scanKnownPatientFolders(
    drive: drive_v3.Drive,
    integration: ClinicStorageIntegration,
  ) {
    if (!integration.patientsFolderId) {
      return { imported: 0, updated: 0, scanned: 0 };
    }

    const patientShortIds = await this.getPatientShortIdMap(
      integration.clinicId,
    );
    const patientFolders = await this.listChildren(
      drive,
      integration.patientsFolderId,
      {
        foldersOnly: true,
      },
    );
    let imported = 0;
    let updated = 0;
    let scanned = 0;

    for (const patientFolder of patientFolders) {
      if (
        !patientFolder.id ||
        !patientFolder.name ||
        !isKnownPatientFolderName(patientFolder.name)
      ) {
        continue;
      }

      const patientId = patientShortIds.get(
        patientFolder.name.split('__').at(-1) ?? '',
      );
      if (!patientId) continue;

      const categoryFolders = await this.listChildren(drive, patientFolder.id, {
        foldersOnly: true,
      });

      for (const categoryFolder of categoryFolders) {
        if (!categoryFolder.id || !categoryFolder.name) continue;

        if (
          !PATIENT_DRIVE_FOLDERS.includes(
            categoryFolder.name as (typeof PATIENT_DRIVE_FOLDERS)[number],
          ) ||
          categoryFolder.name === '_index'
        ) {
          continue;
        }

        const files = await this.listChildren(drive, categoryFolder.id, {
          filesOnly: true,
        });
        for (const file of files) {
          scanned += 1;
          const result = await this.upsertDriveFile(
            patientId,
            categoryFolder.id,
            categoryFolder.name,
            this.snapshotDriveFile(file),
          );
          if (result === 'imported') imported += 1;
          if (result === 'updated') updated += 1;
        }
      }
    }

    return { imported, updated, scanned };
  }

  private async upsertDriveFile(
    patientId: string,
    folderId: string,
    category: string,
    file: DriveFileSnapshot,
  ): Promise<'imported' | 'updated'> {
    const existing = await this.patientFileRepository.findOne({
      where: { driveFileId: file.id },
      withDeleted: true,
    });
    const inferredType = patientFileTypeFromDriveFolder(category);
    const storageStatus =
      category === 'misc'
        ? PatientFileStorageStatus.PENDING_CLASSIFICATION
        : PatientFileStorageStatus.AVAILABLE;
    const patch: Partial<PatientFile> = {
      patientId,
      type: inferredType,
      originalName: file.name,
      storedName: file.name,
      path: `google-drive://${file.id}`,
      url: file.webViewLink ?? file.webContentLink ?? '',
      mimeType: file.mimeType,
      size: file.size,
      storageProvider: StorageProviderType.GOOGLE_DRIVE,
      storageStatus,
      driveFileId: file.id,
      driveFolderId: folderId,
      checksum: file.md5Checksum,
      driveModifiedAt: file.modifiedTime,
      externalMetadataJson: {
        appProperties: file.appProperties,
        parents: file.parents,
      },
    };

    if (existing) {
      Object.assign(existing, patch, {
        syncSource: PatientFileSyncSource.DRIVE_UPDATE,
        deletedAt: null,
      });
      await this.patientFileRepository.save(existing);
      return 'updated';
    }

    await this.patientFileRepository.save(
      this.patientFileRepository.create({
        ...patch,
        uploadedByMembershipId: null,
        appointmentId:
          file.appProperties.entityType === 'appointment'
            ? file.appProperties.entityId
            : null,
        clinicalNoteId:
          file.appProperties.entityType === 'clinical_note'
            ? file.appProperties.entityId
            : null,
        treatmentId:
          file.appProperties.entityType === 'treatment'
            ? file.appProperties.entityId
            : null,
        description: null,
        syncSource: PatientFileSyncSource.DRIVE_IMPORT,
      }),
    );
    return 'imported';
  }

  private async listChildren(
    drive: drive_v3.Drive,
    parentId: string,
    options: { foldersOnly?: boolean; filesOnly?: boolean } = {},
  ): Promise<drive_v3.Schema$File[]> {
    const mimeQuery = options.foldersOnly
      ? ` and mimeType = '${DRIVE_FOLDER_MIME_TYPE}'`
      : options.filesOnly
        ? ` and mimeType != '${DRIVE_FOLDER_MIME_TYPE}'`
        : '';
    const files: drive_v3.Schema$File[] = [];
    let pageToken: string | undefined;

    do {
      const response = await drive.files.list({
        q: `'${parentId}' in parents and trashed = false${mimeQuery}`,
        pageSize: 1000,
        pageToken,
        fields:
          'nextPageToken, files(id,name,mimeType,size,md5Checksum,modifiedTime,webViewLink,webContentLink,parents,appProperties)',
      });
      files.push(...(response.data.files ?? []));
      pageToken = response.data.nextPageToken ?? undefined;
    } while (pageToken);

    return files;
  }

  private snapshotDriveFile(file: drive_v3.Schema$File): DriveFileSnapshot {
    if (!file.id || !file.name || !file.mimeType) {
      throw new BadRequestException('Invalid Google Drive file metadata');
    }

    return {
      id: file.id,
      name: file.name,
      mimeType: file.mimeType,
      size: Number(file.size ?? 0),
      md5Checksum: file.md5Checksum ?? null,
      modifiedTime: file.modifiedTime ? new Date(file.modifiedTime) : null,
      webViewLink: file.webViewLink ?? null,
      webContentLink: file.webContentLink ?? null,
      parents: file.parents ?? [],
      appProperties: file.appProperties ?? {},
    };
  }

  private async getPatientShortIdMap(clinicId: string) {
    const patients = await this.patientRepository.find({
      where: { clinicId },
      select: { id: true },
    });

    return new Map(
      patients.map((patient) => [shortId(patient.id), patient.id]),
    );
  }

  private async getClinic(clinicId: string): Promise<Clinic> {
    const clinic = await this.clinicRepository.findOne({
      where: { id: clinicId, isActive: true },
    });

    if (!clinic)
      throw new NotFoundException(`Clinic with id ${clinicId} not found`);
    return clinic;
  }

  private toPublicIntegration(integration: ClinicStorageIntegration) {
    return {
      provider: integration.provider,
      status: integration.status,
      connected: integration.status === StorageIntegrationStatus.CONNECTED,
      rootFolderId: integration.rootFolderId,
      patientsFolderId: integration.patientsFolderId,
      tokenExpiresAt: integration.tokenExpiresAt,
      metadataJson: integration.metadataJson,
    };
  }
}
