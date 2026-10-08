import {
  BadRequestException,
  ConflictException,
  Injectable,
  NotFoundException,
} from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository } from 'typeorm';
import { promises as fs } from 'fs';
import * as path from 'path';
import { createHash, randomUUID } from 'crypto';

import { Patient } from '../patients/entities/patient.entity';
import { PatientFile } from './entities/patient-file.entity';
import { CreatePatientFileDto } from './dto/create-patient-file.dto';
import { PatientFileStorageStatus } from './interfaces/patient-file-storage-status.enum';
import { PatientFileSyncSource } from './interfaces/patient-file-sync-source.enum';
import { PatientFileType } from './interfaces/patient-file-type.enum';
import {
  ClinicAccessContext,
  PatientAccessService,
} from '../patients/services/patient-access.service';
import { MembershipService } from '../membership/membership.service';
import { StorageProviderType } from '../storage/interfaces/storage-provider-type.enum';
import { StorageService } from '../storage/storage.service';
import { validateAndNormalizeUploadedFile } from '../common/files/upload-validation';
import { deleteUploadedFile } from '../common/files/upload-cleanup';
import type { UploadedFile } from '../common/files/uploaded-file.interface';
import { PatientFileScopeService } from './services/patient-file-scope.service';
import { ImportPatientFileFromDriveDto } from './dto/import-patient-file-from-drive.dto';
import { UpdatePatientFileDto } from './dto/update-patient-file.dto';
import { User } from '../auth/entities/user.entity';
import { appendPatientFileSyncAudit } from './utils/patient-file-sync-audit.util';

export interface GeneratedPatientFileInput {
  originalName: string;
  path: string;
  mimeType: string;
  size: number;
  type: PatientFileType;
  description?: string;
  appointmentId?: string | null;
  clinicalNoteId?: string | null;
  treatmentId?: string | null;
}

@Injectable()
export class PatientFilesService {
  constructor(
    @InjectRepository(PatientFile)
    private readonly patientFileRepository: Repository<PatientFile>,

    @InjectRepository(Patient)
    private readonly patientRepository: Repository<Patient>,

    private readonly patientAccessService: PatientAccessService,

    private readonly membershipService: MembershipService,

    private readonly storageService: StorageService,

    private readonly patientFileScope: PatientFileScopeService,
  ) {}

  async create(
    context: ClinicAccessContext,
    patientId: string,
    uploadedByMembershipId: string,
    file: UploadedFile,
    baseUrl: string,
    dto: CreatePatientFileDto,
  ) {
    if (!file) {
      throw new BadRequestException('No file uploaded');
    }

    return this.withUploadCleanup(
      () => file.path,
      async () => {
        await validateAndNormalizeUploadedFile(file, [
          'image',
          'pdf',
          'text',
          'word',
        ]);
        this.patientAccessService.assertCanManageClinical(context);
        await this.patientAccessService.assertPatientAccessible(
          context,
          patientId,
        );
        const patient = await this.patientFileScope.findPatientInClinic(
          patientId,
          context.clinicId,
        );
        await this.membershipService.assertCanStoreFile(
          context.clinicId,
          file.size,
        );
        await this.patientFileScope.assertRelationsForPatient({
          patientId,
          clinicId: context.clinicId,
          appointmentId: dto.appointmentId,
          clinicalNoteId: dto.clinicalNoteId,
          treatmentId: dto.treatmentId,
        });

        const fileType = dto.type ?? this.inferFileType(file.mimetype);
        return this.uploadAndSaveFile({
          context,
          patient,
          patientId,
          uploadedByMembershipId,
          file,
          baseUrl,
          type: fileType,
          description: dto.description,
          appointmentId: dto.appointmentId,
          clinicalNoteId: dto.clinicalNoteId,
          treatmentId: dto.treatmentId,
        });
      },
    );
  }

  async importFromDrive(
    context: ClinicAccessContext,
    patientId: string,
    uploadedByMembershipId: string,
    user: User,
    dto: ImportPatientFileFromDriveDto,
  ) {
    this.patientAccessService.assertCanManageClinical(context);
    await this.patientAccessService.assertPatientAccessible(context, patientId);
    const patient = await this.patientFileScope.findPatientInClinic(
      patientId,
      context.clinicId,
    );
    await this.patientFileScope.assertRelationsForPatient({
      patientId,
      clinicId: context.clinicId,
      appointmentId: dto.appointmentId,
      clinicalNoteId: dto.clinicalNoteId,
      treatmentId: dto.treatmentId,
    });

    const patientFileId = randomUUID();
    const storageResult = await this.storageService.importFromDrive({
      clinicId: context.clinicId,
      clinicName: patient.clinic.name,
      patientId,
      patientFileId,
      uploadedByMembershipId,
      sourceDriveFileId: dto.driveFileId,
      type: dto.type,
      description: dto.description,
      relation: {
        appointmentId: dto.appointmentId ?? null,
        clinicalNoteId: dto.clinicalNoteId ?? null,
        treatmentId: dto.treatmentId ?? null,
      },
    });

    try {
      await this.membershipService.assertCanStoreFile(
        context.clinicId,
        storageResult.size,
      );
      const sourceName = storageResult.externalMetadataJson?.originalName;
      const externalMetadataJson = {
        ...(storageResult.externalMetadataJson ?? {}),
      };
      delete externalMetadataJson.driveImportSourceParents;
      delete externalMetadataJson.driveImportSourceAppProperties;
      delete externalMetadataJson.driveImportManagedFolderId;
      const patientFile = this.patientFileRepository.create({
        id: patientFileId,
        patientId,
        appointmentId: dto.appointmentId ?? null,
        clinicalNoteId: dto.clinicalNoteId ?? null,
        treatmentId: dto.treatmentId ?? null,
        uploadedByMembershipId,
        uploadedByUserId: user.id,
        storageIntegrationId: storageResult.storageIntegrationId ?? null,
        type: dto.type,
        description: dto.description ?? null,
        originalName:
          typeof sourceName === 'string'
            ? sourceName
            : storageResult.storedName,
        storedName: storageResult.storedName,
        path: storageResult.path,
        url: storageResult.url,
        mimeType: storageResult.mimeType,
        size: storageResult.size,
        storageProvider: storageResult.storageProvider,
        storageStatus: PatientFileStorageStatus.AVAILABLE,
        syncSource: PatientFileSyncSource.DRIVE_IMPORT,
        driveFileId: storageResult.driveFileId ?? null,
        driveFolderId: storageResult.driveFolderId ?? null,
        checksum: null,
        driveModifiedAt: storageResult.driveModifiedAt ?? null,
        externalMetadataJson,
      });

      patientFile.externalMetadataJson = appendPatientFileSyncAudit(
        patientFile.externalMetadataJson,
        {
          event: 'patient_file_imported',
          source: 'app',
          details: {
            userId: user.id,
            driveFileId: storageResult.driveFileId,
            patientId,
            type: dto.type,
          },
        },
      );
      return await this.patientFileRepository.save(patientFile);
    } catch (error) {
      await this.storageService.rollbackDriveImport(storageResult);
      throw error;
    }
  }

  async createProfilePhoto(
    context: ClinicAccessContext,
    patientId: string,
    uploadedByMembershipId: string,
    file: UploadedFile,
    baseUrl: string,
  ) {
    if (!file) {
      throw new BadRequestException('No file uploaded');
    }

    return this.withUploadCleanup(
      () => file.path,
      async () => {
        await validateAndNormalizeUploadedFile(file, ['image']);
        this.patientAccessService.assertCanManagePatients(context);
        await this.patientAccessService.assertPatientAccessible(
          context,
          patientId,
        );
        const patient = await this.patientFileScope.findPatientInClinic(
          patientId,
          context.clinicId,
        );
        await this.membershipService.assertCanStoreFile(
          context.clinicId,
          file.size,
        );
        const savedFile = await this.uploadAndSaveFile({
          context,
          patient,
          patientId,
          uploadedByMembershipId,
          file,
          baseUrl,
          type: PatientFileType.PROFILE_PHOTO,
          description: 'Foto de perfil',
        });

        const result = await this.patientRepository
          .update(
            { id: patientId, clinicId: context.clinicId },
            {
              profilePhotoFileId: savedFile.id,
              profilePhotoUrl: savedFile.url,
            },
          )
          .catch(async (error: unknown) => {
            await this.compensateStoredFile(savedFile, context.clinicId);
            throw error;
          });

        if (!result.affected) {
          await this.compensateStoredFile(savedFile, context.clinicId);
          throw new NotFoundException(`Patient ${patientId} not found`);
        }

        return savedFile;
      },
    );
  }

  async createGenerated(
    context: ClinicAccessContext,
    patientId: string,
    uploadedByMembershipId: string,
    baseUrl: string,
    input: GeneratedPatientFileInput,
  ) {
    return this.withUploadCleanup(
      () => input.path,
      async () => {
        this.patientAccessService.assertCanManageClinical(context);
        await this.patientAccessService.assertPatientAccessible(
          context,
          patientId,
        );
        const patient = await this.patientFileScope.findPatientInClinic(
          patientId,
          context.clinicId,
        );
        await this.membershipService.assertCanStoreFile(
          context.clinicId,
          input.size,
        );

        await this.patientFileScope.assertRelationsForPatient({
          patientId,
          clinicId: context.clinicId,
          appointmentId: input.appointmentId,
          clinicalNoteId: input.clinicalNoteId,
          treatmentId: input.treatmentId,
        });

        const file = this.toGeneratedUploadFile(input);
        return this.uploadAndSaveFile({
          context,
          patient,
          patientId,
          uploadedByMembershipId,
          file,
          baseUrl,
          type: input.type,
          description: input.description ?? null,
          appointmentId: input.appointmentId,
          clinicalNoteId: input.clinicalNoteId,
          treatmentId: input.treatmentId,
        });
      },
    );
  }

  async findAllByPatient(context: ClinicAccessContext, patientId: string) {
    await this.patientAccessService.assertPatientAccessible(context, patientId);

    return await this.patientFileRepository.find({
      where: { patientId },
      order: { createdAt: 'DESC' },
    });
  }

  async findOne(context: ClinicAccessContext, id: string) {
    const patientFile = await this.patientFileRepository
      .createQueryBuilder('file')
      .innerJoin('file.patient', 'patient')
      .where('file.id = :id', { id })
      .andWhere('patient.clinicId = :clinicId', {
        clinicId: context.clinicId,
      })
      .getOne();

    if (!patientFile) {
      throw new NotFoundException(`Patient file ${id} not found`);
    }

    await this.patientAccessService.assertPatientAccessible(
      context,
      patientFile.patientId,
    );

    return patientFile;
  }

  async updateMetadata(
    context: ClinicAccessContext,
    id: string,
    dto: UpdatePatientFileDto,
  ) {
    this.patientAccessService.assertCanManageClinical(context);
    const patientFile = await this.findOne(context, id);
    const before = {
      name: patientFile.originalName,
      description: patientFile.description,
      type: patientFile.type,
    };
    const originalName = dto.originalName?.trim();
    if (originalName && /[\\/]/.test(originalName)) {
      throw new BadRequestException('File name must not contain a path');
    }

    if (patientFile.storageProvider === StorageProviderType.GOOGLE_DRIVE) {
      const patient = await this.patientFileScope.findPatientInClinic(
        patientFile.patientId,
        context.clinicId,
      );
      const updated = await this.storageService.updateDriveMetadata(
        patientFile,
        {
          name: originalName,
          description: dto.description,
          type: dto.type,
          clinicId: context.clinicId,
          clinicName: patient.clinic.name,
          patient,
        },
      );
      patientFile.storedName = updated.storedName;
      patientFile.driveFolderId = updated.driveFolderId ?? null;
      patientFile.driveModifiedAt = updated.driveModifiedAt ?? null;
      patientFile.externalMetadataJson = updated.externalMetadataJson ?? {};
    }

    if (dto.type) patientFile.type = dto.type;
    if (originalName) patientFile.originalName = originalName;
    if (dto.description !== undefined)
      patientFile.description = dto.description;
    patientFile.externalMetadataJson = appendPatientFileSyncAudit(
      patientFile.externalMetadataJson,
      {
        event: 'patient_file_metadata_updated',
        source: 'app',
        details: {
          membershipId: context.membershipId,
          before,
          after: {
            name: patientFile.originalName,
            description: patientFile.description,
            type: patientFile.type,
          },
        },
      },
    );
    delete patientFile.externalMetadataJson.syncConflict;
    patientFile.syncSource = PatientFileSyncSource.APP;
    patientFile.syncReviewRequired = false;
    patientFile.syncReviewReason = null;
    return this.patientFileRepository.save(patientFile);
  }

  async restoreFromDrive(context: ClinicAccessContext, id: string) {
    this.patientAccessService.assertCanManageClinical(context);
    const patientFile = await this.findOne(context, id);
    if (patientFile.storageProvider !== StorageProviderType.GOOGLE_DRIVE) {
      throw new BadRequestException('Only Google Drive files can be restored');
    }

    const updated = await this.storageService.restoreDriveFile(patientFile);
    patientFile.storageStatus = PatientFileStorageStatus.AVAILABLE;
    patientFile.syncSource = PatientFileSyncSource.APP;
    patientFile.syncReviewRequired = false;
    patientFile.syncReviewReason = null;
    patientFile.originalName = updated.storedName;
    patientFile.storedName = updated.storedName;
    patientFile.size = updated.size;
    patientFile.mimeType = updated.mimeType;
    patientFile.driveFolderId =
      updated.driveFolderId ?? patientFile.driveFolderId;
    patientFile.driveModifiedAt = updated.driveModifiedAt ?? null;
    patientFile.externalMetadataJson = updated.externalMetadataJson ?? {};
    patientFile.externalMetadataJson = appendPatientFileSyncAudit(
      patientFile.externalMetadataJson,
      {
        event: 'patient_file_restored_from_drive_trash',
        source: 'app',
        details: { membershipId: context.membershipId },
      },
    );
    return this.patientFileRepository.save(patientFile);
  }

  async listDriveRevisions(context: ClinicAccessContext, id: string) {
    const patientFile = await this.findOne(context, id);
    if (patientFile.storageProvider !== StorageProviderType.GOOGLE_DRIVE)
      throw new BadRequestException('Only Google Drive files have revisions');
    return this.storageService.listDriveRevisions(patientFile);
  }

  async downloadDriveRevision(
    context: ClinicAccessContext,
    id: string,
    revisionId: string,
  ) {
    const patientFile = await this.findOne(context, id);
    if (patientFile.storageProvider !== StorageProviderType.GOOGLE_DRIVE)
      throw new BadRequestException('Only Google Drive files have revisions');
    return {
      stream: await this.storageService.downloadDriveRevision(
        patientFile,
        revisionId,
      ),
      mimeType: patientFile.mimeType,
      originalName: patientFile.originalName,
    };
  }

  async getDownload(context: ClinicAccessContext, id: string) {
    const patientFile = await this.findOne(context, id);

    if (patientFile.storageStatus !== PatientFileStorageStatus.AVAILABLE) {
      throw new BadRequestException('Patient file is not available');
    }

    if (patientFile.storageProvider === StorageProviderType.GOOGLE_DRIVE) {
      return {
        stream: await this.storageService.downloadDrive(
          patientFile,
          context.clinicId,
        ),
        path: undefined,
        mimeType: patientFile.mimeType,
        originalName: patientFile.originalName,
      };
    }

    const uploadDir = path.resolve(process.cwd(), 'uploads', 'patient-files');
    const filePath = path.resolve(uploadDir, patientFile.storedName);

    if (!filePath.startsWith(`${uploadDir}${path.sep}`)) {
      throw new BadRequestException('Invalid stored file path');
    }

    await fs.access(filePath).catch(() => {
      throw new NotFoundException(`Patient file ${id} not found`);
    });

    return {
      path: filePath,
      stream: undefined,
      mimeType: patientFile.mimeType,
      originalName: patientFile.originalName,
    };
  }

  async remove(
    context: ClinicAccessContext,
    id: string,
    confirmDriveTrash = false,
  ) {
    this.patientAccessService.assertCanManageClinical(context);
    const patientFile = await this.findOne(context, id);
    if (
      patientFile.storageProvider === StorageProviderType.GOOGLE_DRIVE &&
      !confirmDriveTrash
    )
      throw new ConflictException({
        code: 'DRIVE_TRASH_CONFIRMATION_REQUIRED',
        message:
          'Confirm that this file should be moved to Google Drive Trash.',
      });

    await this.storageService.markUnavailable(patientFile.storageProvider, {
      clinicId: context.clinicId,
      storedName: patientFile.storedName,
      driveFileId: patientFile.driveFileId,
      storageIntegrationId: patientFile.storageIntegrationId,
    });

    patientFile.storageStatus = PatientFileStorageStatus.UNAVAILABLE;
    if (patientFile.storageProvider === StorageProviderType.GOOGLE_DRIVE) {
      patientFile.externalMetadataJson = appendPatientFileSyncAudit(
        patientFile.externalMetadataJson,
        {
          event: 'patient_file_moved_to_drive_trash',
          source: 'app',
          details: { membershipId: context.membershipId },
        },
      );
      patientFile.syncSource = PatientFileSyncSource.APP;
      patientFile.syncReviewRequired = false;
      patientFile.syncReviewReason = null;
    }
    await this.patientFileRepository.manager.transaction(async (manager) => {
      await manager.getRepository(PatientFile).save(patientFile);
      await manager
        .getRepository(Patient)
        .update(
          { id: patientFile.patientId, profilePhotoFileId: patientFile.id },
          { profilePhotoFileId: null, profilePhotoUrl: null },
        );
    });

    if (patientFile.storageProvider === StorageProviderType.LOCAL) {
      await this.patientFileRepository.softRemove(patientFile);
    }

    return { message: `Patient file ${id} deleted` };
  }

  private async uploadAndSaveFile(input: {
    context: ClinicAccessContext;
    patient: Patient;
    patientId: string;
    uploadedByMembershipId: string;
    file: UploadedFile;
    baseUrl: string;
    type: PatientFileType;
    description?: string | null;
    appointmentId?: string | null;
    clinicalNoteId?: string | null;
    treatmentId?: string | null;
  }) {
    const id = randomUUID();
    const checksum = await this.calculateChecksum(input.file.path);
    const storageResult = await this.storageService.upload({
      uploadedByMembershipId: input.uploadedByMembershipId,
      clinicId: input.context.clinicId,
      clinicName: input.patient.clinic.name,
      patient: input.patient,
      fileId: id,
      file: input.file,
      type: input.type,
      description: input.description ?? null,
      checksum,
      baseUrl: input.baseUrl,
      relation: {
        appointmentId: input.appointmentId ?? null,
        clinicalNoteId: input.clinicalNoteId ?? null,
        treatmentId: input.treatmentId ?? null,
      },
    });

    try {
      const patientFile = this.patientFileRepository.create({
        id,
        patientId: input.patientId,
        appointmentId: input.appointmentId ?? null,
        clinicalNoteId: input.clinicalNoteId ?? null,
        treatmentId: input.treatmentId ?? null,
        uploadedByMembershipId: input.uploadedByMembershipId,
        uploadedByUserId: storageResult.uploadedByUserId ?? null,
        storageIntegrationId: storageResult.storageIntegrationId ?? null,
        type: input.type,
        description: input.description ?? null,
        originalName: input.file.originalname,
        storedName: storageResult.storedName,
        path: storageResult.path,
        url: storageResult.url,
        mimeType: storageResult.mimeType,
        size: storageResult.size,
        storageProvider: storageResult.storageProvider,
        storageStatus: PatientFileStorageStatus.AVAILABLE,
        syncSource: PatientFileSyncSource.APP,
        driveFileId: storageResult.driveFileId ?? null,
        driveFolderId: storageResult.driveFolderId ?? null,
        checksum,
        driveModifiedAt: storageResult.driveModifiedAt ?? null,
        externalMetadataJson: appendPatientFileSyncAudit(
          storageResult.externalMetadataJson,
          {
            event: 'patient_file_uploaded',
            source: 'app',
            details: {
              membershipId: input.uploadedByMembershipId,
              patientId: input.patientId,
              type: input.type,
            },
          },
        ),
      });
      const saved = await this.patientFileRepository.save(patientFile);

      if (storageResult.storageProvider === StorageProviderType.GOOGLE_DRIVE) {
        await deleteUploadedFile(input.file.path);
      }

      return saved;
    } catch (error) {
      try {
        await this.storageService.markUnavailable(
          storageResult.storageProvider,
          {
            clinicId: input.context.clinicId,
            storedName: storageResult.storedName,
            driveFileId: storageResult.driveFileId,
            storageIntegrationId: storageResult.storageIntegrationId,
          },
        );
      } catch (compensationError) {
        throw new AggregateError(
          [error, compensationError],
          'Patient file metadata persistence and storage compensation both failed',
          { cause: compensationError },
        );
      }
      throw error;
    }
  }

  private async compensateStoredFile(
    patientFile: PatientFile,
    clinicId: string,
  ) {
    patientFile.storageStatus = PatientFileStorageStatus.UNAVAILABLE;
    if (patientFile.storageProvider === StorageProviderType.GOOGLE_DRIVE) {
      patientFile.syncSource = PatientFileSyncSource.DRIVE_UPDATE;
    }
    await this.patientFileRepository.save(patientFile);
    await this.storageService.markUnavailable(patientFile.storageProvider, {
      clinicId,
      storedName: patientFile.storedName,
      driveFileId: patientFile.driveFileId,
      storageIntegrationId: patientFile.storageIntegrationId,
    });
    if (patientFile.storageProvider === StorageProviderType.LOCAL) {
      await this.patientFileRepository.softRemove(patientFile);
    }
  }

  private async withUploadCleanup<T>(
    getFilePath: () => string,
    action: () => Promise<T>,
  ): Promise<T> {
    try {
      return await action();
    } catch (error) {
      await deleteUploadedFile(getFilePath());
      throw error;
    }
  }

  private inferFileType(mimeType: string): PatientFileType {
    if (mimeType.startsWith('image/')) return PatientFileType.IMAGE;
    if (mimeType === 'application/pdf') return PatientFileType.PDF;
    return PatientFileType.OTHER;
  }

  private async calculateChecksum(filePath: string): Promise<string> {
    const hash = createHash('sha256');
    const content = await fs.readFile(filePath);
    hash.update(content);
    return hash.digest('hex');
  }

  private toGeneratedUploadFile(
    input: GeneratedPatientFileInput,
  ): UploadedFile {
    return {
      originalname: input.originalName,
      mimetype: input.mimeType,
      size: input.size,
      destination: path.dirname(input.path),
      filename: path.basename(input.path),
      path: input.path,
    };
  }
}
