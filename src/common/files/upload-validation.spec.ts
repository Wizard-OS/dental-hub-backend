import { promises as fs } from 'fs';
import * as os from 'os';
import * as path from 'path';

import { BadRequestException } from '@nestjs/common';
import { utils, write } from 'cfb';

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

  function compound(
    entries: Record<string, Buffer>,
    fileType: 'cfb' | 'zip',
  ): Buffer {
    const container = utils.cfb_new();

    for (const [name, bytes] of Object.entries(entries))
      utils.cfb_add(container, name, bytes);
    const output: unknown = write(container, { type: 'buffer', fileType });

    if (!Buffer.isBuffer(output)) throw new Error('Expected buffer');

    return output;
  }

  it('rejects generic ZIP and OLE containers disguised as Word', async () => {
    for (const fileType of ['zip', 'cfb'] as const) {
      const file = await writeUpload(
        'disguised.doc',
        compound({ Workbook: Buffer.alloc(64) }, fileType),
      );

      await expect(
        validateAndNormalizeUploadedFile(file, ['word']),
      ).rejects.toBeInstanceOf(BadRequestException);
    }
  });

  it('accepts a Word binary stream with the DOC identifier', async () => {
    const header = Buffer.alloc(64);

    header.writeUInt16LE(0xa5ec);
    const file = await writeUpload(
      'document.bin',
      compound({ WordDocument: header, '0Table': Buffer.alloc(32) }, 'cfb'),
    );

    await expect(
      validateAndNormalizeUploadedFile(file, ['word']),
    ).resolves.toMatchObject({ extension: '.doc' });
  });

  it('identifies DOCX instead of accepting any ZIP', async () => {
    const file = await writeUpload(
      'document.bin',
      compound(
        {
          '[Content_Types].xml': Buffer.from(
            '<Types xmlns="http://schemas.openxmlformats.org/package/2006/content-types"><Override PartName="/word/document.xml" ContentType="application/vnd.openxmlformats-officedocument.wordprocessingml.document.main+xml"/></Types>',
          ),
          'word/document.xml': Buffer.from(
            '<w:document xmlns:w="http://schemas.openxmlformats.org/wordprocessingml/2006/main"/>',
          ),
        },
        'zip',
      ),
    );

    await expect(
      validateAndNormalizeUploadedFile(file, ['word']),
    ).resolves.toMatchObject({ extension: '.docx' });
  });

  it('rejects a truncated archive', async () => {
    const file = await writeUpload(
      'broken.docx',
      Buffer.from([0x50, 0x4b, 0x03, 0x04]),
    );

    await expect(
      validateAndNormalizeUploadedFile(file, ['word']),
    ).rejects.toBeInstanceOf(BadRequestException);
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
