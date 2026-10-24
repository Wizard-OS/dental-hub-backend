import { createHash } from 'crypto';

import { BadRequestException } from '@nestjs/common';

import { GoogleDriveIntegrationService } from './google-drive-integration.service';

describe('GoogleDriveIntegrationService OAuth state', () => {
  const clinicId = 'clinic-1';
  const userId = 'user-1';
  const redirectUri = 'https://app.example.test/drive/callback';

  function createService(stateUpdateAffected = 0) {
    const queryBuilder = {
      delete: jest.fn().mockReturnThis(),
      update: jest.fn().mockReturnThis(),
      set: jest.fn().mockReturnThis(),
      where: jest.fn().mockReturnThis(),
      andWhere: jest.fn().mockReturnThis(),
      execute: jest.fn().mockResolvedValue({ affected: stateUpdateAffected }),
    };
    const oauthStateRepository = {
      createQueryBuilder: jest.fn(() => queryBuilder),
      create: jest.fn((state: unknown) => state),
      save: jest.fn((state: unknown) => Promise.resolve(state)),
    };
    const integrationRepository = {
      findOne: jest.fn().mockResolvedValue(null),
      create: jest.fn((integration: unknown) => integration),
      save: jest.fn((integration: unknown) => Promise.resolve(integration)),
    };
    const clinicRepository = {
      findOne: jest.fn().mockResolvedValue({ id: clinicId, name: 'Clinic' }),
    };
    const drive = {
      changes: {
        getStartPageToken: jest
          .fn()
          .mockResolvedValue({ data: { startPageToken: 'page-token' } }),
      },
    };
    const provider = {
      buildAuthUrl: jest.fn((_redirectUri: string, state: string) => state),
      exchangeCode: jest.fn().mockResolvedValue({
        access_token: 'access-token',
        refresh_token: 'refresh-token',
      }),
      ensureClinicFolders: jest.fn().mockResolvedValue({
        rootFolderId: 'root',
        patientsFolderId: 'patients',
      }),
      getDrive: jest.fn().mockResolvedValue(drive),
    };
    const tokenEncryption = {
      encrypt: jest.fn((token: string) => `encrypted:${token}`),
    };
    const service = new GoogleDriveIntegrationService(
      integrationRepository as never,
      clinicRepository as never,
      {} as never,
      {} as never,
      oauthStateRepository as never,
      provider as never,
      tokenEncryption as never,
    );

    return {
      service,
      queryBuilder,
      oauthStateRepository,
      integrationRepository,
      provider,
    };
  }

  it('creates a random, hashed, short-lived state bound to the user and clinic', async () => {
    const { service, oauthStateRepository, provider } = createService();

    const result = await service.buildOAuthUrl(clinicId, userId, redirectUri);
    const state = provider.buildAuthUrl.mock.calls[0]?.[1] ?? '';
    const storedState = oauthStateRepository.save.mock.calls[0]?.[0] as {
      clinicId: string;
      userId: string;
      redirectUri: string;
      stateHash: string;
      expiresAt: Date;
      consumedAt: null;
    };

    expect(result.url).toBe(state);
    expect(state).toHaveLength(43);
    expect(storedState).toMatchObject({
      clinicId,
      userId,
      redirectUri,
      consumedAt: null,
      stateHash: createHash('sha256').update(state).digest('hex'),
    });
    expect(storedState.stateHash).not.toBe(state);
    expect(storedState.expiresAt.getTime()).toBeGreaterThan(Date.now());
  });

  it('consumes valid state before exchanging the authorization code', async () => {
    const { service, queryBuilder, provider } = createService(1);

    await service.connect(
      clinicId,
      userId,
      'oauth-code',
      redirectUri,
      'x'.repeat(43),
    );

    expect(queryBuilder.update).toHaveBeenCalledTimes(1);
    expect(queryBuilder.andWhere).toHaveBeenCalledWith(
      '"clinicId" = :clinicId',
      { clinicId },
    );
    expect(queryBuilder.andWhere).toHaveBeenCalledWith('"userId" = :userId', {
      userId,
    });
    expect(queryBuilder.andWhere).toHaveBeenCalledWith(
      '"redirectUri" = :redirectUri',
      { redirectUri },
    );
    expect(provider.exchangeCode).toHaveBeenCalledWith(
      'oauth-code',
      redirectUri,
    );
  });

  it('rejects replayed or mismatched state before exchanging the code', async () => {
    const { service, provider } = createService(0);

    await expect(
      service.connect(
        clinicId,
        userId,
        'oauth-code',
        redirectUri,
        'x'.repeat(43),
      ),
    ).rejects.toThrow(BadRequestException);

    expect(provider.exchangeCode).not.toHaveBeenCalled();
  });
});
