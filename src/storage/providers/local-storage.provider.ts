import {
  BadRequestException,
  Injectable,
  InternalServerErrorException,
} from '@nestjs/common';
import { promises as fs } from 'fs';
import * as path from 'path';

import {
  StorageProvider,
  StorageUploadInput,
  StorageUploadResult,
} from '../interfaces/storage-provider.interface';
import { StorageProviderType } from '../interfaces/storage-provider-type.enum';

@Injectable()
export class LocalStorageProvider implements StorageProvider {
  readonly type = StorageProviderType.LOCAL;

  upload(input: StorageUploadInput): Promise<StorageUploadResult> {
    return Promise.resolve({
      storageProvider: StorageProviderType.LOCAL,
      storedName: input.file.filename,
      path: input.file.path,
      url: `${input.baseUrl}/api/patient-files/${input.fileId}/download`,
      mimeType: input.file.mimetype,
      size: input.file.size,
      driveFileId: null,
      driveFolderId: null,
      driveModifiedAt: null,
      externalMetadataJson: {},
    });
  }

  async markUnavailable(file: { storedName: string }): Promise<void> {
    const uploadDir = path.resolve(process.cwd(), 'uploads', 'patient-files');
    const filePath = path.resolve(uploadDir, file.storedName);

    if (!filePath.startsWith(`${uploadDir}${path.sep}`)) {
      throw new BadRequestException('Invalid stored file path');
    }

    try {
      await fs.unlink(filePath);
    } catch (error) {
      if (
        error instanceof Object &&
        'code' in error &&
        error.code === 'ENOENT'
      ) {
        return;
      }

      throw new InternalServerErrorException(
        'Could not delete stored patient file',
      );
    }
  }
}
