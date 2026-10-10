import { apiMessage, type ApiMessage } from '../i18n/api-message';
import { BadRequestException } from '@nestjs/common';
import { FileInterceptor } from '@nestjs/platform-express';
import { diskStorage } from 'multer';
import { promises as fs } from 'fs';
import * as path from 'path';

const DOCUMENT_MIME_TYPES = new Set([
  'application/pdf',
  'text/plain',
  'application/msword',
  'application/vnd.openxmlformats-officedocument.wordprocessingml.document',
]);

interface UploadInterceptorOptions {
  directory: 'patient-files' | 'profile-photos';
  maxSizeMb: number;
  allowDocuments?: boolean;
  imageOnlyMessage?: ApiMessage;
  filename: (request: Express.Request, file: Express.Multer.File) => string;
}

export function createUploadInterceptor(options: UploadInterceptorOptions) {
  return FileInterceptor('file', {
    storage: diskStorage({
      destination: (req, file, cb) => {
        const uploadDir = path.join(
          process.cwd(),
          'uploads',
          options.directory,
        );
        void fs.mkdir(uploadDir, { recursive: true }).then(
          () => cb(null, uploadDir),
          (error: Error) => cb(error, uploadDir),
        );
      },
      filename: (req, file, cb) => {
        cb(null, options.filename(req, file));
      },
    }),
    fileFilter: (req, file, cb) => {
      if (file.mimetype.startsWith('image/')) {
        return cb(null, true);
      }

      if (options.allowDocuments && DOCUMENT_MIME_TYPES.has(file.mimetype)) {
        return cb(null, true);
      }

      return cb(
        new BadRequestException(
          options.imageOnlyMessage ??
            apiMessage('api.messages.file_type_is_not_allowed'),
        ),
        false,
      );
    },
    limits: { fileSize: options.maxSizeMb * 1024 * 1024 },
  });
}

export function timestampedUploadName(): string {
  return `${Date.now()}-${Math.round(Math.random() * 1e9)}`;
}
