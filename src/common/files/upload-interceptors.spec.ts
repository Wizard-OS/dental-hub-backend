import { randomUUID } from 'node:crypto';
import { promises as fs } from 'node:fs';
import type { Server } from 'node:http';
import * as path from 'node:path';

import {
  Body,
  Controller,
  INestApplication,
  Post,
  UploadedFile as UploadedFileParameter,
  UseInterceptors,
} from '@nestjs/common';
import { Test } from '@nestjs/testing';
import request from 'supertest';

import { createUploadInterceptor } from './upload-interceptors';

const storedPaths = new Set<string>();

@Controller('upload-contract')
class UploadContractController {
  @Post()
  @UseInterceptors(
    createUploadInterceptor({
      directory: 'patient-files',
      maxSizeMb: 16 / (1024 * 1024),
      allowDocuments: true,
      filename: () => {
        const filename = `dependency-contract-${randomUUID()}`;

        storedPaths.add(
          path.join(process.cwd(), 'uploads', 'patient-files', filename),
        );

        return filename;
      },
    }),
  )
  upload(
    @UploadedFileParameter() file: Express.Multer.File | undefined,
    @Body() body: { note?: string },
  ) {
    return { size: file?.size, fieldLength: body.note?.length };
  }
}

describe('upload dependency compatibility', () => {
  let app: INestApplication;

  beforeAll(async () => {
    const module = await Test.createTestingModule({
      controllers: [UploadContractController],
    }).compile();

    app = module.createNestApplication();
    await app.init();
  });

  afterEach(async () => {
    for (const filePath of storedPaths) {
      await fs.rm(filePath, { force: true });
    }
    storedPaths.clear();
  });

  afterAll(async () => {
    await app?.close();
  });

  it.each([15, 16])(
    'accepts a file of %i bytes at or below the limit',
    async (size) => {
      const response = await request(app.getHttpServer() as Server)
        .post('/upload-contract')
        .attach('file', Buffer.alloc(size), {
          filename: 'document.pdf',
          contentType: 'application/pdf',
        })
        .expect(201);

      expect(response.body).toEqual({ size });
    },
  );

  it('rejects an oversized file and removes the partial disk upload', async () => {
    await request(app.getHttpServer() as Server)
      .post('/upload-contract')
      .attach('file', Buffer.alloc(17), {
        filename: 'document.pdf',
        contentType: 'application/pdf',
      })
      .expect(413);

    expect(storedPaths.size).toBe(1);
    for (const filePath of storedPaths) {
      await expect(fs.access(filePath)).rejects.toMatchObject({
        code: 'ENOENT',
      });
    }
  });

  it('rejects unsupported MIME types before writing a file', async () => {
    await request(app.getHttpServer() as Server)
      .post('/upload-contract')
      .attach('file', Buffer.from('script'), {
        filename: 'script.js',
        contentType: 'application/javascript',
      })
      .expect(400);

    expect(storedPaths.size).toBe(0);
  });

  it('keeps fields just below 1 MiB accepted', async () => {
    const response = await request(app.getHttpServer() as Server)
      .post('/upload-contract')
      .field('note', 'a'.repeat(1024 * 1024 - 1))
      .expect(201);

    expect(response.body).toEqual({ fieldLength: 1024 * 1024 - 1 });
  });

  it.each([1024 * 1024, 1024 * 1024 + 1])(
    'keeps a field of %i bytes rejected',
    async (size) => {
      await request(app.getHttpServer() as Server)
        .post('/upload-contract')
        .field('note', 'a'.repeat(size))
        .expect(400);
    },
  );
});
