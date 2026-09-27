import {
  BadRequestException,
  Injectable,
  NotFoundException,
} from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository } from 'typeorm';
import type { Express } from 'express';
import { promises as fs } from 'fs';
import * as path from 'path';
import { createHash, randomUUID } from 'crypto';
import { Readable } from 'stream';

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
import { PatientFileScopeService } from './services/patient-file-scope.service';

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
    file: Express.Multer.File,
    baseUrl: string,
    dto: CreatePatientFileDto,
  ) {
    if (!file) {
      throw new BadRequestException('No file uploaded');
    }

    try {
      await validateAndNormalizeUploadedFile(file, [
        'image',
        'pdf',
        'text',
        'word',
      ]);
    } catch (error) {
      await deleteUploadedFile(file.path);
      throw error;
    }

    this.patientAccessService.assertCanManageClinical(context);
    await this.patientAccessService.assertPatientAccessible(context, patientId);
    const patient = await this.patientFileScope.findPatientInClinic(
      patientId,
      context.clinicId,
    );

    try {
      await this.membershipService.assertCanStoreFile(
        context.clinicId,
        file.size,
      );
    } catch (error) {
      await deleteUploadedFile(file.path);
      throw error;
    }

    await this.patientFileScope.assertRelationsForPatient({
      patientId,
      clinicId: context.clinicId,
      appointmentId: dto.appointmentId,
      clinicalNoteId: dto.clinicalNoteId,
      treatmentId: dto.treatmentId,
    });

    const patientFileId = randomUUID();
    const fileType = dto.type ?? this.inferFileType(file.mimetype);
    const checksum = await this.calculateChecksum(file.path);
    let storageResult;

    try {
      storageResult = await this.storageService.upload({
        clinicId: context.clinicId,
        clinicName: patient.clinic.name,
        patient,
        fileId: patientFileId,
        file,
        type: fileType,
        checksum,
        baseUrl,
        relation: {
          appointmentId: dto.appointmentId ?? null,
          clinicalNoteId: dto.clinicalNoteId ?? null,
          treatmentId: dto.treatmentId ?? null,
        },
      });
    } catch (error) {
      await deleteUploadedFile(file.path);
      throw error;
    }

    if (storageResult.storageProvider === StorageProviderType.GOOGLE_DRIVE) {
      await deleteUploadedFile(file.path);
    }

    const patientFile = this.patientFileRepository.create({
      id: patientFileId,
      patientId,
      appointmentId: dto.appointmentId ?? null,
      clinicalNoteId: dto.clinicalNoteId ?? null,
      treatmentId: dto.treatmentId ?? null,
      uploadedByMembershipId,
      type: fileType,
      description: dto.description ?? null,
      originalName: file.originalname,
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
      externalMetadataJson: storageResult.externalMetadataJson ?? {},
    });

    return await this.patientFileRepository.save(patientFile);
  }

  async createProfilePhoto(
    context: ClinicAccessContext,
    patientId: string,
    uploadedByMembershipId: string,
    file: Express.Multer.File,
    baseUrl: string,
  ) {
    if (!file) {
      throw new BadRequestException('No file uploaded');
    }

    try {
      await validateAndNormalizeUploadedFile(file, ['image']);
    } catch (error) {
      await deleteUploadedFile(file.path);
      throw error;
    }

    this.patientAccessService.assertCanManagePatients(context);
    await this.patientAccessService.assertPatientAccessible(context, patientId);
    const patient = await this.patientFileScope.findPatientInClinic(
      patientId,
      context.clinicId,
    );

    try {
      await this.membershipService.assertCanStoreFile(
        context.clinicId,
        file.size,
      );
    } catch (error) {
      await deleteUploadedFile(file.path);
      throw error;
    }

    const patientFileId = randomUUID();
    const checksum = await this.calculateChecksum(file.path);
    let storageResult;

    try {
      storageResult = await this.storageService.upload({
        clinicId: context.clinicId,
        clinicName: patient.clinic.name,
        patient,
        fileId: patientFileId,
        file,
        type: PatientFileType.PROFILE_PHOTO,
        checksum,
        baseUrl,
        relation: {
          appointmentId: null,
          clinicalNoteId: null,
          treatmentId: null,
        },
      });
    } catch (error) {
      await deleteUploadedFile(file.path);
      throw error;
    }

    if (storageResult.storageProvider === StorageProviderType.GOOGLE_DRIVE) {
      await deleteUploadedFile(file.path);
    }

    const patientFile = this.patientFileRepository.create({
      id: patientFileId,
      patientId,
      appointmentId: null,
      clinicalNoteId: null,
      treatmentId: null,
      uploadedByMembershipId,
      type: PatientFileType.PROFILE_PHOTO,
      description: 'Foto de perfil',
      originalName: file.originalname,
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
      externalMetadataJson: storageResult.externalMetadataJson ?? {},
    });

    const savedFile = await this.patientFileRepository.save(patientFile);
    await this.patientRepository.update(
      { id: patientId, clinicId: context.clinicId },
      {
        profilePhotoFileId: savedFile.id,
        profilePhotoUrl: savedFile.url,
      },
    );

    return savedFile;
  }

  async createGenerated(
    context: ClinicAccessContext,
    patientId: string,
    uploadedByMembershipId: string,
    baseUrl: string,
    input: GeneratedPatientFileInput,
  ) {
    this.patientAccessService.assertCanManageClinical(context);
    await this.patientAccessService.assertPatientAccessible(context, patientId);
    const patient = await this.patientFileScope.findPatientInClinic(
      patientId,
      context.clinicId,
    );

    try {
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

      const patientFileId = randomUUID();
      const checksum = await this.calculateChecksum(input.path);
      const file = this.toGeneratedMulterFile(input);
      const storageResult = await this.storageService.upload({
        clinicId: context.clinicId,
        clinicName: patient.clinic.name,
        patient,
        fileId: patientFileId,
        file,
        type: input.type,
        checksum,
        baseUrl,
        relation: {
          appointmentId: input.appointmentId ?? null,
          clinicalNoteId: input.clinicalNoteId ?? null,
          treatmentId: input.treatmentId ?? null,
        },
      });

      if (storageResult.storageProvider === StorageProviderType.GOOGLE_DRIVE) {
        await deleteUploadedFile(input.path);
      }

      const patientFile = this.patientFileRepository.create({
        id: patientFileId,
        patientId,
        appointmentId: input.appointmentId ?? null,
        clinicalNoteId: input.clinicalNoteId ?? null,
        treatmentId: input.treatmentId ?? null,
        uploadedByMembershipId,
        type: input.type,
        description: input.description ?? null,
        originalName: input.originalName,
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
        externalMetadataJson: storageResult.externalMetadataJson ?? {},
      });

      return await this.patientFileRepository.save(patientFile);
    } catch (error) {
      await deleteUploadedFile(input.path);
      throw error;
    }
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

  async getDownload(context: ClinicAccessContext, id: string) {
    const patientFile = await this.findOne(context, id);

    if (patientFile.storageProvider !== StorageProviderType.LOCAL) {
      throw new BadRequestException(
        'Direct download is only available for local files',
      );
    }

    if (patientFile.storageStatus !== PatientFileStorageStatus.AVAILABLE) {
      throw new BadRequestException('Patient file is not available');
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
      mimeType: patientFile.mimeType,
      originalName: patientFile.originalName,
    };
  }

  async remove(context: ClinicAccessContext, id: string) {
    this.patientAccessService.assertCanManageClinical(context);
    const patientFile = await this.findOne(context, id);
    await this.storageService.markUnavailable(patientFile.storageProvider, {
      clinicId: context.clinicId,
      storedName: patientFile.storedName,
      driveFileId: patientFile.driveFileId,
    });

    if (patientFile.storageProvider === StorageProviderType.GOOGLE_DRIVE) {
      patientFile.storageStatus = PatientFileStorageStatus.UNAVAILABLE;
      patientFile.syncSource = PatientFileSyncSource.DRIVE_UPDATE;
      await this.patientFileRepository.save(patientFile);
    } else {
      await this.patientFileRepository.softRemove(patientFile);
    }

    await this.patientRepository.update(
      { id: patientFile.patientId, profilePhotoFileId: patientFile.id },
      { profilePhotoFileId: null, profilePhotoUrl: null },
    );

    return { message: `Patient file ${id} deleted` };
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

  private toGeneratedMulterFile(
    input: GeneratedPatientFileInput,
  ): Express.Multer.File {
    return {
      fieldname: 'file',
      originalname: input.originalName,
      encoding: '7bit',
      mimetype: input.mimeType,
      size: input.size,
      destination: path.dirname(input.path),
      filename: path.basename(input.path),
      path: input.path,
      buffer: Buffer.alloc(0),
      stream: Readable.from([]),
    };
  }
}
