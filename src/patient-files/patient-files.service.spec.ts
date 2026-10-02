import { promises as fs } from 'fs';
import * as os from 'os';
import * as path from 'path';

import { PatientFilesService } from './patient-files.service';
import { PatientFile } from './entities/patient-file.entity';
import { Patient } from '../patients/entities/patient.entity';
import { PatientFileStorageStatus } from './interfaces/patient-file-storage-status.enum';
import { PatientFileSyncSource } from './interfaces/patient-file-sync-source.enum';
import { PatientFileType } from './interfaces/patient-file-type.enum';
import { StorageProviderType } from '../storage/interfaces/storage-provider-type.enum';
import type { UploadedFile } from '../common/files/uploaded-file.interface';

describe('PatientFilesService storage lifecycle', () => {
  let temporaryDirectory: string;
  let storageService: { upload: jest.Mock; markUnavailable: jest.Mock };
  let patientFileRepository: {
    create: jest.Mock;
    save: jest.Mock;
    softRemove: jest.Mock;
  };
  let patientRepository: { update: jest.Mock };
  let service: PatientFilesService;
  const patient = {
    id: 'patient-id',
    clinic: { name: 'Dental Hub' },
  } as Patient;
  const context = { clinicId: 'clinic-id' } as never;

  beforeEach(async () => {
    temporaryDirectory = await fs.mkdtemp(
      path.join(os.tmpdir(), 'patient-files-service-'),
    );
    storageService = {
      upload: jest
        .fn()
        .mockImplementation(({ file }: { file: UploadedFile }) => ({
          storedName: 'stored.png',
          path: '/storage/stored.png',
          url: 'https://storage.example/stored.png',
          mimeType: file.mimetype,
          size: file.size,
          storageProvider: StorageProviderType.GOOGLE_DRIVE,
          driveFileId: 'drive-file-id',
          driveFolderId: 'drive-folder-id',
        })),
      markUnavailable: jest.fn().mockResolvedValue(undefined),
    };
    patientFileRepository = {
      create: jest.fn((entity: PatientFile) => entity),
      save: jest.fn((entity: PatientFile) => Promise.resolve(entity)),
      softRemove: jest.fn((entity: PatientFile) => Promise.resolve(entity)),
    };
    patientRepository = {
      update: jest.fn().mockResolvedValue({ affected: 1 }),
    };

    service = new PatientFilesService(
      patientFileRepository as never,
      patientRepository as never,
      {
        assertCanManageClinical: jest.fn(),
        assertCanManagePatients: jest.fn(),
        assertPatientAccessible: jest.fn().mockResolvedValue(undefined),
      } as never,
      { assertCanStoreFile: jest.fn().mockResolvedValue(undefined) } as never,
      storageService as never,
      {
        findPatientInClinic: jest.fn().mockResolvedValue(patient),
        assertRelationsForPatient: jest.fn().mockResolvedValue(undefined),
      } as never,
    );
  });

  afterEach(async () => {
    await fs.rm(temporaryDirectory, { recursive: true, force: true });
  });

  async function createUpload() {
    const filePath = path.join(temporaryDirectory, 'upload.bin');
    const signature = Buffer.from([
      0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a,
    ]);
    await fs.writeFile(filePath, signature);
    return {
      filePath,
      file: {
        fieldname: 'file',
        originalname: 'image.png',
        mimetype: 'image/png',
        size: signature.length,
        destination: temporaryDirectory,
        filename: 'upload.bin',
        path: filePath,
      },
    };
  }

  it('removes the normalized temporary file and compensates remote storage when metadata persistence fails', async () => {
    const { file, filePath } = await createUpload();
    patientFileRepository.save.mockRejectedValueOnce(
      new Error('database unavailable'),
    );

    await expect(
      service.create(context, 'patient-id', 'membership-id', file, '', {
        type: PatientFileType.IMAGE,
      }),
    ).rejects.toThrow('database unavailable');

    expect(storageService.markUnavailable).toHaveBeenCalledWith(
      StorageProviderType.GOOGLE_DRIVE,
      expect.objectContaining({ driveFileId: 'drive-file-id' }),
    );
    await expect(fs.access(filePath.replace('.bin', '.png'))).rejects.toThrow();
  });

  it('marks a profile photo unavailable if its patient association cannot be persisted', async () => {
    const { file } = await createUpload();
    const savedFile = {
      id: 'file-id',
      storageProvider: StorageProviderType.GOOGLE_DRIVE,
      storedName: 'stored.png',
      driveFileId: 'drive-file-id',
      storageStatus: PatientFileStorageStatus.AVAILABLE,
      syncSource: PatientFileSyncSource.APP,
    } as PatientFile;
    patientFileRepository.save.mockResolvedValue(savedFile);
    patientRepository.update.mockRejectedValueOnce(
      new Error('patient update failed'),
    );

    await expect(
      service.createProfilePhoto(
        context,
        'patient-id',
        'membership-id',
        file,
        '',
      ),
    ).rejects.toThrow('patient update failed');

    expect(savedFile.storageStatus).toBe(PatientFileStorageStatus.UNAVAILABLE);
    expect(savedFile.syncSource).toBe(PatientFileSyncSource.DRIVE_UPDATE);
    expect(patientFileRepository.save).toHaveBeenCalledTimes(2);
    expect(storageService.markUnavailable).toHaveBeenCalledTimes(1);
  });
});
