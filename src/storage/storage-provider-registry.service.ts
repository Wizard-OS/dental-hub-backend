import { Injectable } from '@nestjs/common';

import { StorageProvider } from './interfaces/storage-provider.interface';
import { StorageProviderType } from './interfaces/storage-provider-type.enum';
import { GoogleDriveStorageProvider } from './providers/google-drive-storage.provider';
import { LocalStorageProvider } from './providers/local-storage.provider';

@Injectable()
export class StorageProviderRegistry {
  private readonly providers: Map<StorageProviderType, StorageProvider>;

  constructor(
    localStorageProvider: LocalStorageProvider,
    googleDriveStorageProvider: GoogleDriveStorageProvider,
  ) {
    this.providers = new Map(
      [localStorageProvider, googleDriveStorageProvider].map((provider) => [
        provider.type,
        provider,
      ]),
    );
  }

  get(providerType: StorageProviderType): StorageProvider {
    return (
      this.providers.get(providerType) ??
      this.providers.get(StorageProviderType.LOCAL)!
    );
  }
}
