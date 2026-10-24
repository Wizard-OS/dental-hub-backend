import * as path from 'path';

import { PatientFileType } from '../../patient-files/interfaces/patient-file-type.enum';

export const DRIVE_FOLDER_MIME_TYPE = 'application/vnd.google-apps.folder';

export const PATIENT_DRIVE_FOLDERS = [
  '_index',
  'avatar',
  'radiographs',
  'clinical-images',
  'documents',
  'misc',
] as const;

export type PatientDriveFolder = (typeof PATIENT_DRIVE_FOLDERS)[number];

export function shortId(id: string, length = 6): string {
  return id.replace(/-/g, '').slice(0, length).toLowerCase();
}

export function slugifyForDrive(value: string): string {
  const slug = value
    .normalize('NFD')
    .replace(/[\u0300-\u036f]/g, '')
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, '-')
    .replace(/^-+|-+$/g, '')
    .slice(0, 80);

  return slug || 'clinica';
}

export function buildClinicRootFolderName(
  clinicId: string,
  clinicName: string,
): string {
  return `DentalHub__tenant-${shortId(clinicId)}__${slugifyForDrive(clinicName)}`;
}

export function buildPatientFolderName(patientId: string): string {
  const patientIdShort = shortId(patientId);

  return `patient-PAC-${patientIdShort.toUpperCase()}__${patientIdShort}`;
}

export function folderForPatientFileType(
  type: PatientFileType,
): PatientDriveFolder {
  if (type === PatientFileType.PROFILE_PHOTO) return 'avatar';

  if (type === PatientFileType.RADIOGRAPHY) return 'radiographs';

  if (type === PatientFileType.IMAGE) return 'clinical-images';

  if (type === PatientFileType.PDF || type === PatientFileType.DOCUMENT) {
    return 'documents';
  }

  return 'misc';
}

export function patientFileTypeFromDriveFolder(
  folder: string,
): PatientFileType {
  if (folder === 'radiographs') return PatientFileType.RADIOGRAPHY;

  if (folder === 'avatar') return PatientFileType.PROFILE_PHOTO;

  if (folder === 'clinical-images') {
    return PatientFileType.IMAGE;
  }

  if (folder === 'documents') return PatientFileType.DOCUMENT;

  return PatientFileType.OTHER;
}

export function buildDriveFileName(
  type: PatientFileType,
  originalName: string,
  fileId: string,
  now = new Date(),
): string {
  const date = now.toISOString().slice(0, 10);
  const extension = path.extname(originalName).toLowerCase();
  const prefixByType: Record<PatientFileType, string> = {
    [PatientFileType.PROFILE_PHOTO]: 'profile-photo',
    [PatientFileType.IMAGE]: 'clinical-image',
    [PatientFileType.RADIOGRAPHY]: 'rx',
    [PatientFileType.PDF]: 'document',
    [PatientFileType.DOCUMENT]: 'document',
    [PatientFileType.OTHER]: 'attachment',
  };

  return `${prefixByType[type]}__${date}__file-${shortId(fileId)}${extension}`;
}

export function isKnownPatientFolderName(name: string): boolean {
  return /^patient-PAC-[A-Z0-9]{6}__[a-z0-9]{6}$/.test(name);
}
