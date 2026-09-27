import { Module } from '@nestjs/common';
import { TypeOrmModule } from '@nestjs/typeorm';

import { Clinic } from '../clinics/entities/clinic.entity';
import { PatientFile } from '../patient-files/entities/patient-file.entity';
import { Patient } from '../patients/entities/patient.entity';
import { ClinicStorageIntegration } from './entities/clinic-storage-integration.entity';
import { GoogleDriveIntegrationController } from './google-drive-integration.controller';
import { GoogleDriveIntegrationService } from './google-drive-integration.service';
import { GoogleDriveStorageProvider } from './providers/google-drive-storage.provider';
import { LocalStorageProvider } from './providers/local-storage.provider';
import { StorageService } from './storage.service';
import { TokenEncryptionService } from './token-encryption.service';
import { StorageProviderRegistry } from './storage-provider-registry.service';

@Module({
  imports: [
    TypeOrmModule.forFeature([
      ClinicStorageIntegration,
      Clinic,
      Patient,
      PatientFile,
    ]),
  ],
  controllers: [GoogleDriveIntegrationController],
  providers: [
    StorageService,
    LocalStorageProvider,
    GoogleDriveStorageProvider,
    StorageProviderRegistry,
    GoogleDriveIntegrationService,
    TokenEncryptionService,
  ],
  exports: [
    StorageService,
    GoogleDriveStorageProvider,
    GoogleDriveIntegrationService,
    TokenEncryptionService,
    TypeOrmModule,
  ],
})
export class StorageModule {}
