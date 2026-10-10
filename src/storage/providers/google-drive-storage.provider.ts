import { apiMessage } from '../../common/i18n/api-message';
import { BadRequestException, Injectable } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { OAuth2Client } from 'google-auth-library';
import { drive_v3, google } from 'googleapis';
import { createReadStream } from 'fs';
import { Repository } from 'typeorm';

import { ClinicStorageIntegration } from '../entities/clinic-storage-integration.entity';
import { StorageIntegrationStatus } from '../interfaces/storage-integration-status.enum';
import {
  StorageProvider,
  StorageUploadInput,
  StorageUploadResult,
} from '../interfaces/storage-provider.interface';
import { StorageProviderType } from '../interfaces/storage-provider-type.enum';
import { TokenEncryptionService } from '../token-encryption.service';
import {
  buildClinicRootFolderName,
  buildDriveFileName,
  buildPatientFolderName,
  DRIVE_FOLDER_MIME_TYPE,
  folderForPatientFileType,
  PATIENT_DRIVE_FOLDERS,
} from '../utils/drive-naming.util';

@Injectable()
export class GoogleDriveStorageProvider implements StorageProvider {
  readonly type = StorageProviderType.GOOGLE_DRIVE;

  constructor(
    @InjectRepository(ClinicStorageIntegration)
    private readonly integrationRepository: Repository<ClinicStorageIntegration>,
    private readonly tokenEncryption: TokenEncryptionService,
  ) {}

  private createOAuthClient(redirectUri?: string): OAuth2Client {
    const clientId = process.env.GOOGLE_DRIVE_CLIENT_ID;
    const clientSecret = process.env.GOOGLE_DRIVE_CLIENT_SECRET;

    if (!clientId || !clientSecret) {
      throw new BadRequestException(
        apiMessage(
          'api.messages.google_drive_client_id_and_google_drive_client_secret_are_required',
        ),
      );
    }

    return new google.auth.OAuth2(clientId, clientSecret, redirectUri);
  }

  buildAuthUrl(redirectUri: string, state: string): string {
    return this.createOAuthClient(redirectUri).generateAuthUrl({
      access_type: 'offline',
      prompt: 'consent',
      scope: ['https://www.googleapis.com/auth/drive.file'],
      state,
    });
  }

  async exchangeCode(
    code: string,
    redirectUri: string,
  ): Promise<{
    access_token?: string | null;
    refresh_token?: string | null;
    expiry_date?: number | null;
    scope?: string;
    token_type?: string | null;
  }> {
    const client = this.createOAuthClient(redirectUri);
    const { tokens } = await client.getToken(code);
    return tokens;
  }

  async getDrive(
    integration: ClinicStorageIntegration,
  ): Promise<drive_v3.Drive> {
    const client = this.createOAuthClient();

    if (
      !integration.encryptedRefreshToken &&
      !integration.encryptedAccessToken
    ) {
      throw new BadRequestException(
        apiMessage('api.messages.google_drive_integration_is_not_connected'),
      );
    }

    client.setCredentials({
      access_token: integration.encryptedAccessToken
        ? this.tokenEncryption.decrypt(integration.encryptedAccessToken)
        : undefined,
      refresh_token: integration.encryptedRefreshToken
        ? this.tokenEncryption.decrypt(integration.encryptedRefreshToken)
        : undefined,
      expiry_date: integration.tokenExpiresAt?.getTime(),
    });

    await client.getAccessToken();
    if (client.credentials.access_token) {
      integration.encryptedAccessToken = this.tokenEncryption.encrypt(
        client.credentials.access_token,
      );
      integration.tokenExpiresAt = client.credentials.expiry_date
        ? new Date(client.credentials.expiry_date)
        : null;
      await this.integrationRepository.save(integration);
    }
    return google.drive({ version: 'v3', auth: client });
  }

  async ensureClinicFolders(
    integration: ClinicStorageIntegration,
    clinicName: string,
  ): Promise<{ rootFolderId: string; patientsFolderId: string }> {
    const drive = await this.getDrive(integration);
    const rootFolderId =
      integration.rootFolderId ??
      (await this.findOrCreateFolder(
        drive,
        buildClinicRootFolderName(integration.clinicId, clinicName),
      ));
    const patientsFolderId =
      integration.patientsFolderId ??
      (await this.findOrCreateFolder(drive, 'patients', rootFolderId));

    return { rootFolderId, patientsFolderId };
  }

  async ensurePatientFolders(
    integration: ClinicStorageIntegration,
    input: Pick<StorageUploadInput, 'clinicName' | 'patient'>,
  ): Promise<Record<string, string>> {
    const drive = await this.getDrive(integration);
    const { patientsFolderId } = await this.ensureClinicFolders(
      integration,
      input.clinicName,
    );
    const patientFolderId = await this.findOrCreateFolder(
      drive,
      buildPatientFolderName(input.patient.id),
      patientsFolderId,
    );
    const folders: Record<string, string> = {
      patient: patientFolderId,
    };

    for (const folderName of PATIENT_DRIVE_FOLDERS) {
      folders[folderName] = await this.findOrCreateFolder(
        drive,
        folderName,
        patientFolderId,
      );
    }

    return folders;
  }

  async upload(input: StorageUploadInput): Promise<StorageUploadResult> {
    const integration = await this.requireActiveIntegration(input.clinicId);
    const folders = await this.ensurePatientFolders(integration, input);
    const category = folderForPatientFileType(input.type);
    const drive = await this.getDrive(integration);
    const driveName = buildDriveFileName(
      input.type,
      input.file.originalname,
      input.fileId,
    );
    const entityType = this.resolveEntityType(input.relation);
    const entityId =
      input.relation.appointmentId ??
      input.relation.clinicalNoteId ??
      input.relation.treatmentId ??
      '';

    const response = await drive.files.create({
      requestBody: {
        name: driveName,
        parents: [folders[category]],
        appProperties: {
          tenantId: input.clinicId,
          patientId: input.patient.id,
          fileId: input.fileId,
          category,
          entityType,
          entityId,
        },
      },
      media: {
        mimeType: input.file.mimetype,
        body: createReadStream(input.file.path),
      },
      fields:
        'id, name, parents, mimeType, size, md5Checksum, modifiedTime, webViewLink, webContentLink, appProperties',
    });

    return {
      storageProvider: StorageProviderType.GOOGLE_DRIVE,
      storedName: driveName,
      path: `google-drive://${response.data.id ?? ''}`,
      url: response.data.webViewLink ?? response.data.webContentLink ?? '',
      mimeType: response.data.mimeType ?? input.file.mimetype,
      size: Number(response.data.size ?? input.file.size),
      driveFileId: response.data.id ?? null,
      driveFolderId: folders[category],
      driveModifiedAt: response.data.modifiedTime
        ? new Date(response.data.modifiedTime)
        : null,
      externalMetadataJson: {
        md5Checksum: response.data.md5Checksum,
        appProperties: response.data.appProperties ?? {},
        parents: response.data.parents ?? [],
      },
    };
  }

  async markUnavailable(file: {
    clinicId: string;
    driveFileId?: string | null;
  }): Promise<void> {
    if (!file.driveFileId) return;

    const integration = await this.findActiveIntegration(file.clinicId);
    if (!integration) return;

    const drive = await this.getDrive(integration);
    await drive.files.update({
      fileId: file.driveFileId,
      requestBody: { trashed: true },
      fields: 'id, trashed',
    });
  }

  async findOrCreateFolder(
    drive: drive_v3.Drive,
    name: string,
    parentId?: string,
  ): Promise<string> {
    const parentQuery = parentId ? `'${parentId}' in parents` : '';
    const existing = await drive.files.list({
      q: [
        `name = '${this.escapeQueryValue(name)}'`,
        `mimeType = '${DRIVE_FOLDER_MIME_TYPE}'`,
        'trashed = false',
        parentQuery,
      ]
        .filter(Boolean)
        .join(' and '),
      pageSize: 1,
      fields: 'files(id)',
    });
    const existingId = existing.data.files?.[0]?.id;
    if (existingId) return existingId;

    const created = await drive.files.create({
      requestBody: {
        name,
        mimeType: DRIVE_FOLDER_MIME_TYPE,
        parents: parentId ? [parentId] : undefined,
      },
      fields: 'id',
    });

    if (!created.data.id) {
      throw new BadRequestException(
        apiMessage('api.messages.could_not_create_google_drive_folder'),
      );
    }

    return created.data.id;
  }

  private async requireActiveIntegration(
    clinicId: string,
  ): Promise<ClinicStorageIntegration> {
    const integration = await this.findActiveIntegration(clinicId);
    if (!integration) {
      throw new BadRequestException(
        apiMessage('api.messages.google_drive_integration_is_not_connected'),
      );
    }

    return integration;
  }

  private async findActiveIntegration(
    clinicId: string,
  ): Promise<ClinicStorageIntegration | null> {
    return await this.integrationRepository.findOne({
      where: {
        clinicId,
        provider: StorageProviderType.GOOGLE_DRIVE,
        status: StorageIntegrationStatus.CONNECTED,
      },
    });
  }

  private resolveEntityType(relation: StorageUploadInput['relation']): string {
    if (relation.appointmentId) return 'appointment';
    if (relation.clinicalNoteId) return 'clinical_note';
    if (relation.treatmentId) return 'treatment';
    return 'patient';
  }

  private escapeQueryValue(value: string): string {
    return value.replace(/\\/g, '\\\\').replace(/'/g, "\\'");
  }
}
