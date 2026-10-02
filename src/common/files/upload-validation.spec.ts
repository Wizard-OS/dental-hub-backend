import { promises as fs } from 'fs';
import * as os from 'os';
import * as path from 'path';
import { BadRequestException } from '@nestjs/common';

import { validateAndNormalizeUploadedFile } from './upload-validation';
import type { UploadedFile } from './uploaded-file.interface';

describe('validateAndNormalizeUploadedFile', () => {
  let tmpDir: string;

  beforeEach(async () => {
    tmpDir = await fs.mkdtemp(path.join(os.tmpdir(), 'upload-validation-'));
  });

  afterEach(async () => {
    await fs.rm(tmpDir, { recursive: true, force: true });
  });

  it('detects a PDF by bytes and normalizes the stored extension', async () => {
    const file = await writeUpload('document.bin', Buffer.from('%PDF-1.7\n'));

    await expect(
      validateAndNormalizeUploadedFile(file, ['pdf']),
    ).resolves.toEqual({
      mimeType: 'application/pdf',
      extension: '.pdf',
      kind: 'pdf',
    });

    expect(file.filename).toBe('document.pdf');
    expect(file.mimetype).toBe('application/pdf');
    await expect(fs.access(file.path)).resolves.toBeUndefined();
  });

  it('rejects active content even when the declared MIME type is image-like', async () => {
    const file = await writeUpload(
      'avatar.png',
      Buffer.from('<script>alert("xss")</script>'),
      'image/png',
    );

    await expect(
      validateAndNormalizeUploadedFile(file, ['image']),
    ).rejects.toBeInstanceOf(BadRequestException);
  });

  it('allows common image signatures', async () => {
    const file = await writeUpload(
      'avatar',
      Buffer.from([0xff, 0xd8, 0xff, 0xe0, 0x00, 0x10]),
    );

    await validateAndNormalizeUploadedFile(file, ['image']);

    expect(file.filename).toBe('avatar.jpg');
    expect(file.mimetype).toBe('image/jpeg');
  });

  async function writeUpload(
    filename: string,
    content: Buffer,
    mimetype = 'application/octet-stream',
  ): Promise<UploadedFile> {
    const filePath = path.join(tmpDir, filename);
    await fs.writeFile(filePath, content);

    return {
      originalname: filename,
      mimetype,
      size: content.length,
      destination: tmpDir,
      filename,
      path: filePath,
    };
  }
});
