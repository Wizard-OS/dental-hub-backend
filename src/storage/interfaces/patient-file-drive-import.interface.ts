import { PatientFileType } from '../../patient-files/interfaces/patient-file-type.enum';

export interface PatientFileDriveImport {
  clinicId: string;
  clinicName: string;
  patientId: string;
  patientFileId: string;
  uploadedByMembershipId: string;
  sourceDriveFileId: string;
  type: PatientFileType;
  description?: string | null;
  relation: {
    appointmentId?: string | null;
    clinicalNoteId?: string | null;
    treatmentId?: string | null;
  };
}
