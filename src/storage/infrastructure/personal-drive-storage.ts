import {
  ConflictException,
  Injectable,
  NotFoundException,
} from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { IsNull, Repository } from 'typeorm';
import { google, drive_v3 } from 'googleapis';
import { OAuth2Client } from 'google-auth-library';
import { createReadStream, promises as fs } from 'fs';
import { createHash } from 'crypto';
import { pipeline } from 'stream/promises';
import { Readable } from 'stream';
import * as path from 'path';
import * as os from 'os';
import { User } from '../../auth/entities/user.entity';
import { GoogleTokenVerifier } from '../../auth/infrastructure/google-identity-verifier';
import { PatientFile } from '../../patient-files/entities/patient-file.entity';
import { Patient } from '../../patients/entities/patient.entity';
import {
  ClinicAccessContext,
  PatientAccessService,
} from '../../patients/services/patient-access.service';
import { ClinicMembershipRole } from '../../clinic-memberships/interfaces/clinic-membership-role.enum';
import { PatientFileType } from '../../patient-files/interfaces/patient-file-type.enum';
import { PatientFileStorageStatus } from '../../patient-files/interfaces/patient-file-storage-status.enum';
import { PatientFileSyncSource } from '../../patient-files/interfaces/patient-file-sync-source.enum';
import { StorageProviderType } from '../interfaces/storage-provider-type.enum';
import { StorageIntegrationStatus } from '../interfaces/storage-integration-status.enum';
import {
  StorageUploadInput,
  StorageUploadResult,
} from '../interfaces/storage-provider.interface';
import { UserStorageIntegration } from '../entities/user-storage-integration.entity';
import { DriveMigrationItem } from '../entities/drive-migration-item.entity';
import { ClinicStorageIntegration } from '../entities/clinic-storage-integration.entity';
import { GoogleDriveStorageProvider } from '../providers/google-drive-storage.provider';
import { TokenEncryptionService } from '../token-encryption.service';
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
} from '../utils/drive-naming.util';

@Injectable()
export class PersonalDriveStorage implements PersonalDrivePort {
  constructor(
    @InjectRepository(UserStorageIntegration)
    private readonly integrations: Repository<UserStorageIntegration>,
    @InjectRepository(User) private readonly users: Repository<User>,
    @InjectRepository(PatientFile)
    private readonly files: Repository<PatientFile>,
    @InjectRepository(DriveMigrationItem)
    private readonly migrations: Repository<DriveMigrationItem>,
    @InjectRepository(ClinicStorageIntegration)
    private readonly legacyIntegrations: Repository<ClinicStorageIntegration>,
    private readonly tokens: TokenEncryptionService,
    private readonly verifier: GoogleTokenVerifier,
    private readonly legacyDrive: GoogleDriveStorageProvider,
    private readonly access: PatientAccessService,
  ) {}

  async subjectForUser(userId: string) {
    return (
      (await this.users.findOneBy({ id: userId, isActive: true }))
        ?.googleSubject ?? null
    );
  }

  private oauth() {
    if (
      !process.env.GOOGLE_DRIVE_CLIENT_ID ||
      !process.env.GOOGLE_DRIVE_CLIENT_SECRET
    )
      throw this.error(
        'GOOGLE_NOT_CONFIGURED',
        'Google Drive is not configured.',
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
          'Drive authorization expired. Sign in to Google again and allow Drive access.',
        );
      });
    if (!tokens.id_token || !tokens.access_token)
      throw this.error(
        'DRIVE_RECONNECT_REQUIRED',
        'Sign in to Google again and allow Drive access.',
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
        'Reconnect the original Google account to preserve access to your files.',
      );
    if (!authorization.refreshToken && !existing?.encryptedRefreshToken)
      throw this.error(
        'DRIVE_RECONNECT_REQUIRED',
        'Offline Drive permission is missing. Sign in to Google again and allow Drive access.',
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
          'Your DentalHub Drive folder is unavailable. Restore it in Google Drive and reconnect.',
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
    await this.integrations.save(integration);
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

  async disconnect(userId: string) {
    await this.integrations.update(
      { userId },
      {
        status: StorageIntegrationStatus.DISCONNECTED,
        encryptedAccessToken: null,
        encryptedRefreshToken: null,
        tokenExpiresAt: null,
      },
    );
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
        fields: 'files(id,name,size,md5Checksum,mimeType,modifiedTime)',
        pageSize: 2,
      });
      if ((existing.data.files?.length ?? 0) > 1)
        throw this.error(
          'DRIVE_DUPLICATE_FILE',
          'Duplicate Drive files need attention before migration can continue.',
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
            fields: 'id,name,size,md5Checksum,mimeType,modifiedTime',
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
          'Drive upload could not be verified. Retry the upload.',
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
        externalMetadataJson: { md5Checksum: metadata.md5Checksum },
      };
    });
  }

  async download(file: PatientFile, clinicId: string): Promise<Readable> {
    if (!file.driveFileId)
      throw new NotFoundException('Patient file is unavailable.');
    if (!file.storageIntegrationId) {
      const legacy = await this.legacyIntegrations.findOneBy({
        clinicId,
        provider: StorageProviderType.GOOGLE_DRIVE,
        status: StorageIntegrationStatus.CONNECTED,
      });
      if (!legacy)
        throw this.error(
          'DRIVE_RECONNECT_REQUIRED',
          'The original clinic Drive connection is unavailable.',
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
          throw new NotFoundException('This Drive file is unavailable.');
        throw this.error(
          'LEGACY_DRIVE_UNAVAILABLE',
          'The original clinic Drive connection is unavailable. Ask the clinic administrator to reconnect it.',
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
    const files = await this.files.find({
      where: {
        storageIntegrationId: integration.id,
        patient: { clinicId: context.clinicId },
      },
    });
    let scanned = 0,
      updated = 0,
      unavailable = 0;
    for (const file of files) {
      try {
        await this.access.assertPatientAccessible(
          this.context(context),
          file.patientId,
        );
      } catch {
        continue;
      }
      await this.withDrive(integration, async (drive) => {
        scanned++;
        let metadata: drive_v3.Schema$File | null;
        try {
          metadata = (
            await drive.files.get({
              fileId: file.driveFileId!,
              fields: 'id,trashed,name,mimeType,size,md5Checksum,modifiedTime',
            })
          ).data;
        } catch (error) {
          if (this.statusCode(error) !== 404) throw error;
          metadata = null;
        }
        if (!metadata || metadata.trashed) {
          await this.files.update(file.id, {
            storageStatus: PatientFileStorageStatus.UNAVAILABLE,
            syncSource: PatientFileSyncSource.DRIVE_UPDATE,
          });
          unavailable++;
        } else {
          await this.files.save(
            this.files.create({
              ...file,
              storedName: metadata.name ?? file.storedName,
              size: Number(metadata.size ?? file.size),
              mimeType: metadata.mimeType ?? file.mimeType,
              driveModifiedAt: metadata.modifiedTime
                ? new Date(metadata.modifiedTime)
                : null,
              storageStatus: PatientFileStorageStatus.AVAILABLE,
              syncSource: PatientFileSyncSource.DRIVE_UPDATE,
              externalMetadataJson: {
                ...file.externalMetadataJson,
                md5Checksum: metadata.md5Checksum,
              },
            }),
          );
          updated++;
        }
      });
    }
    await this.integrations.update(integration.id, {
      metadataJson: {
        ...integration.metadataJson,
        lastSyncAt: new Date().toISOString(),
      },
    });
    return { provider: 'google_drive' as const, scanned, updated, unavailable };
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
        'Connect your Google Drive before uploading patient files.',
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
        'The file owner needs to reconnect Google Drive.',
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
          'The file owner needs to reconnect Google Drive.',
        );
      }
      if (status === 404)
        throw new NotFoundException('This Drive file is unavailable.');
      if (status === 403)
        throw this.error(
          'DRIVE_ACCESS_DENIED',
          'Drive access or storage quota is unavailable. Check your Google account and retry.',
        );
      throw this.error(
        'DRIVE_UNAVAILABLE',
        'Google Drive is temporarily unavailable. Retry when your connection is restored.',
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
  private error(code: string, message: string) {
    return new ConflictException({ code, message });
  }
}
