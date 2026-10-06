import { StorageService } from './storage.service';
import { StorageProviderType } from './interfaces/storage-provider-type.enum';

describe('StorageService personal ownership', () => {
  it('does not fall back to local storage when the uploader is disconnected', async () => {
    const personal = {
      upload: jest.fn().mockRejectedValue(new Error('Connect your Drive')),
    };
    const registry = { get: jest.fn() };
    const memberships = {
      findOneBy: jest.fn().mockResolvedValue({ userId: 'user-a' }),
    };
    const service = new StorageService(
      memberships as never,
      registry as never,
      personal as never,
    );
    await expect(
      service.upload({
        clinicId: 'clinic',
        uploadedByMembershipId: 'membership-a',
      } as never),
    ).rejects.toThrow('Connect your Drive');
    expect(registry.get).not.toHaveBeenCalled();
  });
  it('routes each uploader to their own Drive', async () => {
    const personal = {
      upload: jest.fn().mockResolvedValue({
        storageProvider: StorageProviderType.GOOGLE_DRIVE,
      }),
    };
    const memberships = {
      findOneBy: jest
        .fn()
        .mockResolvedValueOnce({ userId: 'user-a' })
        .mockResolvedValueOnce({ userId: 'user-b' }),
    };
    const service = new StorageService(
      memberships as never,
      {} as never,
      personal as never,
    );
    const first = {
      clinicId: 'clinic',
      uploadedByMembershipId: 'membership-a',
    };
    const second = {
      clinicId: 'clinic',
      uploadedByMembershipId: 'membership-b',
    };
    await service.upload(first as never);
    await service.upload(second as never);
    expect(personal.upload).toHaveBeenNthCalledWith(1, first, 'user-a');
    expect(personal.upload).toHaveBeenNthCalledWith(2, second, 'user-b');
  });
});
