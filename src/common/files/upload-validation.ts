import { BadRequestException } from '@nestjs/common';
import { promises as fs } from 'fs';
import * as path from 'path';
import type { UploadedFile } from './uploaded-file.interface';

export type AllowedUploadKind = 'image' | 'pdf' | 'text' | 'word';

interface DetectedFileType {
  mimeType: string;
  extension: string;
  kind: AllowedUploadKind;
}

const OLE_HEADER = Buffer.from([
  0xd0, 0xcf, 0x11, 0xe0, 0xa1, 0xb1, 0x1a, 0xe1,
]);

export async function validateAndNormalizeUploadedFile(
  file: UploadedFile,
  allowedKinds: AllowedUploadKind[],
): Promise<DetectedFileType> {
  const detected = await detectFileType(file.path);

  if (!detected || !allowedKinds.includes(detected.kind)) {
    throw new BadRequestException('File type is not allowed');
  }

  await normalizeStoredFileName(file, detected.extension);
  file.mimetype = detected.mimeType;

  return detected;
}

async function detectFileType(
  filePath: string,
): Promise<DetectedFileType | null> {
  const content = await fs.readFile(filePath);

  if (content.subarray(0, 4).equals(Buffer.from('%PDF'))) {
    return { mimeType: 'application/pdf', extension: '.pdf', kind: 'pdf' };
  }

  if (content.subarray(0, 3).equals(Buffer.from([0xff, 0xd8, 0xff]))) {
    return { mimeType: 'image/jpeg', extension: '.jpg', kind: 'image' };
  }

  if (
    content
      .subarray(0, 8)
      .equals(Buffer.from([0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a]))
  ) {
    return { mimeType: 'image/png', extension: '.png', kind: 'image' };
  }

  if (
    content.subarray(0, 6).equals(Buffer.from('GIF87a')) ||
    content.subarray(0, 6).equals(Buffer.from('GIF89a'))
  ) {
    return { mimeType: 'image/gif', extension: '.gif', kind: 'image' };
  }

  if (
    content.subarray(0, 4).equals(Buffer.from('RIFF')) &&
    content.subarray(8, 12).equals(Buffer.from('WEBP'))
  ) {
    return { mimeType: 'image/webp', extension: '.webp', kind: 'image' };
  }

  if (content.subarray(0, OLE_HEADER.length).equals(OLE_HEADER)) {
    return {
      mimeType: 'application/msword',
      extension: '.doc',
      kind: 'word',
    };
  }

  if (content.subarray(0, 4).equals(Buffer.from([0x50, 0x4b, 0x03, 0x04]))) {
    return {
      mimeType:
        'application/vnd.openxmlformats-officedocument.wordprocessingml.document',
      extension: '.docx',
      kind: 'word',
    };
  }

  if (isPlainText(content)) {
    return { mimeType: 'text/plain', extension: '.txt', kind: 'text' };
  }

  return null;
}

async function normalizeStoredFileName(file: UploadedFile, extension: string) {
  const currentExtension = path.extname(file.filename).toLowerCase();
  if (currentExtension === extension) return;

  const baseName = currentExtension
    ? file.filename.slice(0, -currentExtension.length)
    : file.filename;
  const normalizedName = `${baseName}${extension}`;
  const normalizedPath = path.join(file.destination, normalizedName);

  await fs.rename(file.path, normalizedPath);
  file.filename = normalizedName;
  file.path = normalizedPath;
}

function isPlainText(content: Buffer): boolean {
  if (content.length === 0) return false;

  let suspiciousBytes = 0;
  for (const byte of content) {
    if (byte === 0) return false;
    const isCommonWhitespace = byte === 9 || byte === 10 || byte === 13;
    const isPrintableAscii = byte >= 32 && byte <= 126;
    const isUtf8ContinuationOrMultibyte = byte >= 128;
    if (
      !isCommonWhitespace &&
      !isPrintableAscii &&
      !isUtf8ContinuationOrMultibyte
    ) {
      suspiciousBytes += 1;
    }
  }

  return suspiciousBytes / content.length < 0.02;
}
