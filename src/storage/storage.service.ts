import { ConflictException, Injectable } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository } from 'typeorm';
import { ClinicMembership } from '../clinic-memberships/entities/clinic-membership.entity';
import { PatientFile } from '../patient-files/entities/patient-file.entity';
import { PersonalDriveStorage } from './infrastructure/personal-drive-storage';
import { StorageProviderType } from './interfaces/storage-provider-type.enum';
import {
  StorageUploadInput,
  StorageUploadResult,
} from './interfaces/storage-provider.interface';
import { StorageProviderRegistry } from './storage-provider-registry.service';
import { PatientFileDriveImport } from './interfaces/patient-file-drive-import.interface';
import { Patient } from '../patients/entities/patient.entity';
import { PatientFileType } from '../patient-files/interfaces/patient-file-type.enum';

@Injectable()
export class StorageService {
  constructor(
    @InjectRepository(ClinicMembership)
    private readonly memberships: Repository<ClinicMembership>,
    private readonly providerRegistry: StorageProviderRegistry,
    private readonly personalDrive: PersonalDriveStorage,
  ) {}
  async upload(input: StorageUploadInput): Promise<StorageUploadResult> {
    const uploader = await this.memberships.findOneBy({
      id: input.uploadedByMembershipId,
      clinicId: input.clinicId,
      isActive: true,
    });
    if (!uploader)
      throw new ConflictException({
        code: 'UPLOAD_IDENTITY_REQUIRED',
        message: 'The uploader membership is unavailable.',
      });
    return this.personalDrive.upload(input, uploader.userId);
  }

  async importFromDrive(
    input: PatientFileDriveImport,
  ): Promise<StorageUploadResult> {
    const uploader = await this.memberships.findOneBy({
      id: input.uploadedByMembershipId,
      clinicId: input.clinicId,
      isActive: true,
    });
    if (!uploader)
      throw new ConflictException({
        code: 'UPLOAD_IDENTITY_REQUIRED',
        message: 'The uploader membership is unavailable.',
      });
    return this.personalDrive.importFromDrive(input, uploader.userId);
  }

  rollbackDriveImport(result: StorageUploadResult) {
    return this.personalDrive.rollbackImport(result);
  }

  updateDriveMetadata(
    file: PatientFile,
    input: {
      name?: string;
      description?: string | null;
      type?: PatientFileType;
      clinicId: string;
      clinicName: string;
      patient: Patient;
    },
  ) {
    return this.personalDrive.updateMetadata(file, input);
  }

  restoreDriveFile(file: PatientFile) {
    return this.personalDrive.restore(file);
  }

  listDriveRevisions(file: PatientFile) {
    return this.personalDrive.listRevisions(file);
  }

  downloadDriveRevision(file: PatientFile, revisionId: string) {
    return this.personalDrive.downloadRevision(file, revisionId);
  }
  async markUnavailable(
    providerType: StorageProviderType,
    file: {
      clinicId: string;
      storedName: string;
      driveFileId?: string | null;
      storageIntegrationId?: string | null;
    },
  ): Promise<void> {
    if (file.storageIntegrationId && file.driveFileId)
      return this.personalDrive.trash(
        file.storageIntegrationId,
        file.driveFileId,
      );
    await this.providerRegistry.get(providerType).markUnavailable(file);
  }
  downloadDrive(file: PatientFile, clinicId: string) {
    return this.personalDrive.download(file, clinicId);
  }
}
