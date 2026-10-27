import { INestApplication } from '@nestjs/common';
import { Test, TestingModule } from '@nestjs/testing';
import request from 'supertest';
import { App } from 'supertest/types';

import { AppModule } from '../src/app.module';
import { GoogleDriveStorageProvider } from '../src/storage/providers/google-drive-storage.provider';
import { readJsonString } from './support/json-response';
import {
  configureTestApplication,
  seedTestDatabase,
} from './support/test-application';

describe('Google Drive Integration (e2e)', () => {
  let app: INestApplication<App>;
  let ownerToken: string;
  let clinicId: string;
  const originalEncryptionKey = process.env.INTEGRATION_TOKEN_ENCRYPTION_KEY;

  const driveApiMock = {
    changes: {
      getStartPageToken: jest
        .fn()
        .mockResolvedValue({ data: { startPageToken: 'drive-token-1' } }),
      list: jest.fn().mockResolvedValue({
        data: {
          changes: [],
          newStartPageToken: 'drive-token-2',
        },
      }),
    },
    files: {
      list: jest.fn().mockResolvedValue({ data: { files: [] } }),
    },
  };

  const driveProviderMock = {
    buildAuthUrl: jest.fn(
      (_redirectUri: string, state: string) =>
        `https://accounts.google.test/oauth?state=${state}`,
    ),
    exchangeCode: jest.fn().mockResolvedValue({
      access_token: 'access-token',
      refresh_token: 'refresh-token',
      expiry_date: Date.now() + 3600_000,
      scope: 'https://www.googleapis.com/auth/drive.file',
      token_type: 'Bearer',
    }),
    ensureClinicFolders: jest.fn().mockResolvedValue({
      rootFolderId: 'drive-root-folder',
      patientsFolderId: 'drive-patients-folder',
    }),
    getDrive: jest.fn().mockResolvedValue(driveApiMock),
  };

  beforeAll(async () => {
    process.env.INTEGRATION_TOKEN_ENCRYPTION_KEY =
      'test-encryption-secret-of-at-least-32-bytes';

    const moduleFixture: TestingModule = await Test.createTestingModule({
      imports: [AppModule],
    })
      .overrideProvider(GoogleDriveStorageProvider)
      .useValue(driveProviderMock)
      .compile();

    app = moduleFixture.createNestApplication({ bodyParser: false });
    configureTestApplication(app);
    await app.init();

    await seedTestDatabase(app);

    const loginResponse = await request(app.getHttpServer())
      .post('/auth/login')
      .send({
        email: 'test1@google.com',
        password: 'Abc123',
      })
      .expect(201);

    ownerToken = readJsonString(loginResponse.body, 'token');

    const clinicResponse = await request(app.getHttpServer())
      .post('/clinics')
      .set('Authorization', `Bearer ${ownerToken}`)
      .send({
        name: 'Drive Test Clinic',
        timezone: 'America/Montevideo',
        currency: 'USD',
      })
      .expect(201);

    clinicId = readJsonString(clinicResponse.body, 'id');
  });

  afterAll(async () => {
    process.env.INTEGRATION_TOKEN_ENCRYPTION_KEY = originalEncryptionKey;

    if (app) {
      await app.close();
    }
  });

  it('reports disconnected status before OAuth', async () => {
    const response = await request(app.getHttpServer())
      .get('/integrations/google-drive/status')
      .set('Authorization', `Bearer ${ownerToken}`)
      .set('x-clinic-id', clinicId)
      .expect(200);

    expect(response.body).toMatchObject({
      provider: 'google_drive',
      status: 'disconnected',
      connected: false,
    });
  });

  it('connects through OAuth callback and runs manual sync', async () => {
    const oauthUrlResponse = await request(app.getHttpServer())
      .get('/integrations/google-drive/oauth-url')
      .query({ redirectUri: 'http://localhost/google-drive/callback' })
      .set('Authorization', `Bearer ${ownerToken}`)
      .set('x-clinic-id', clinicId)
      .expect(200);

    const state = new URL(
      readJsonString(oauthUrlResponse.body, 'url'),
    ).searchParams.get('state');

    expect(state).toBeTruthy();

    const connectResponse = await request(app.getHttpServer())
      .post('/integrations/google-drive/oauth-callback')
      .set('Authorization', `Bearer ${ownerToken}`)
      .set('x-clinic-id', clinicId)
      .send({
        code: 'oauth-code',
        state,
        redirectUri: 'http://localhost/google-drive/callback',
      })
      .expect(201);

    expect(connectResponse.body).toMatchObject({
      provider: 'google_drive',
      status: 'connected',
      connected: true,
      rootFolderId: 'drive-root-folder',
      patientsFolderId: 'drive-patients-folder',
    });

    const syncResponse = await request(app.getHttpServer())
      .post('/integrations/google-drive/sync')
      .set('Authorization', `Bearer ${ownerToken}`)
      .set('x-clinic-id', clinicId)
      .expect(201);

    expect(syncResponse.body).toMatchObject({
      provider: 'google_drive',
      imported: 0,
      updated: 0,
      scanned: 0,
      unavailable: 0,
    });
    expect(driveProviderMock.exchangeCode).toHaveBeenCalledWith(
      'oauth-code',
      'http://localhost/google-drive/callback',
    );
  });
});
