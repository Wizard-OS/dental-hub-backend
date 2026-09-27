import { StorageIntegrationStatus } from './interfaces/storage-integration-status.enum';
import { StorageProviderType } from './interfaces/storage-provider-type.enum';
import { StorageProviderRegistry } from './storage-provider-registry.service';
import { StorageService } from './storage.service';

describe('StorageService', () => {
  const localProvider = {
    type: StorageProviderType.LOCAL,
    upload: jest.fn(),
    markUnavailable: jest.fn(),
  };
  const driveProvider = {
    type: StorageProviderType.GOOGLE_DRIVE,
    upload: jest.fn(),
    markUnavailable: jest.fn(),
  };

  beforeEach(() => {
    jest.clearAllMocks();
  });

  it('uses local storage when Google Drive is not connected', async () => {
    const repository = { findOne: jest.fn().mockResolvedValue(null) };
    const service = new StorageService(
      repository as never,
      new StorageProviderRegistry(
        localProvider as never,
        driveProvider as never,
      ),
    );
    localProvider.upload.mockResolvedValue({ storageProvider: 'local' });

    await expect(
      service.upload({ clinicId: 'clinic-id' } as never),
    ).resolves.toEqual({ storageProvider: 'local' });
    expect(localProvider.upload).toHaveBeenCalledTimes(1);
    expect(driveProvider.upload).not.toHaveBeenCalled();
  });

  it('uses Google Drive storage when the clinic integration is connected', async () => {
    const repository = {
      findOne: jest.fn().mockResolvedValue({
        status: StorageIntegrationStatus.CONNECTED,
      }),
    };
    const service = new StorageService(
      repository as never,
      new StorageProviderRegistry(
        localProvider as never,
        driveProvider as never,
      ),
    );
    driveProvider.upload.mockResolvedValue({
      storageProvider: StorageProviderType.GOOGLE_DRIVE,
    });

    await expect(
      service.upload({ clinicId: 'clinic-id' } as never),
    ).resolves.toEqual({ storageProvider: StorageProviderType.GOOGLE_DRIVE });
    expect(driveProvider.upload).toHaveBeenCalledTimes(1);
    expect(repository.findOne).toHaveBeenCalledWith({
      where: {
        clinicId: 'clinic-id',
        provider: StorageProviderType.GOOGLE_DRIVE,
        status: StorageIntegrationStatus.CONNECTED,
      },
      select: { id: true },
    });
  });
});
