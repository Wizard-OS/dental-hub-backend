import { Patient } from '../../patients/entities/patient.entity';
import type { UploadedFile } from '../../common/files/uploaded-file.interface';
import { PatientFileType } from '../../patient-files/interfaces/patient-file-type.enum';
import { StorageProviderType } from './storage-provider-type.enum';

export interface StorageUploadInput {
  clinicId: string;
  clinicName: string;
  patient: Patient;
  fileId: string;
  file: UploadedFile;
  type: PatientFileType;
  checksum: string;
  baseUrl: string;
  relation: {
    appointmentId?: string | null;
    clinicalNoteId?: string | null;
    treatmentId?: string | null;
  };
}

export interface StorageUploadResult {
  storageProvider: StorageProviderType;
  storedName: string;
  path: string;
  url: string;
  mimeType: string;
  size: number;
  driveFileId?: string | null;
  driveFolderId?: string | null;
  driveModifiedAt?: Date | null;
  externalMetadataJson?: Record<string, unknown>;
}

export interface StorageProvider {
  readonly type: StorageProviderType;
  upload(input: StorageUploadInput): Promise<StorageUploadResult>;
  markUnavailable(file: {
    clinicId: string;
    storedName: string;
    driveFileId?: string | null;
  }): Promise<void>;
}
