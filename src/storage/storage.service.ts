import { Injectable } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository } from 'typeorm';

import { ClinicStorageIntegration } from './entities/clinic-storage-integration.entity';
import { StorageIntegrationStatus } from './interfaces/storage-integration-status.enum';
import { StorageProviderType } from './interfaces/storage-provider-type.enum';
import {
  StorageUploadInput,
  StorageUploadResult,
} from './interfaces/storage-provider.interface';
import { StorageProviderRegistry } from './storage-provider-registry.service';

@Injectable()
export class StorageService {
  constructor(
    @InjectRepository(ClinicStorageIntegration)
    private readonly integrationRepository: Repository<ClinicStorageIntegration>,
    private readonly providerRegistry: StorageProviderRegistry,
  ) {}

  async upload(input: StorageUploadInput): Promise<StorageUploadResult> {
    return await (await this.getProvider(input.clinicId)).upload(input);
  }

  async markUnavailable(
    providerType: StorageProviderType,
    file: {
      clinicId: string;
      storedName: string;
      driveFileId?: string | null;
    },
  ): Promise<void> {
    await this.providerRegistry.get(providerType).markUnavailable(file);
  }

  async getActiveProviderType(clinicId: string): Promise<StorageProviderType> {
    const integration = await this.integrationRepository.findOne({
      where: {
        clinicId,
        provider: StorageProviderType.GOOGLE_DRIVE,
        status: StorageIntegrationStatus.CONNECTED,
      },
      select: { id: true },
    });

    return integration
      ? StorageProviderType.GOOGLE_DRIVE
      : StorageProviderType.LOCAL;
  }

  private async getProvider(clinicId: string) {
    return this.providerRegistry.get(
      await this.getActiveProviderType(clinicId),
    );
  }
}
