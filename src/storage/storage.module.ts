import { AuthModule } from '../auth/auth.module';
import { User } from '../auth/entities/user.entity';
import { ClinicMembership } from '../clinic-memberships/entities/clinic-membership.entity';
import { PatientsModule } from '../patients/patients.module';
import { UserStorageIntegration } from './entities/user-storage-integration.entity';
import { DriveMigrationItem } from './entities/drive-migration-item.entity';
import { PersonalDriveStorage } from './infrastructure/personal-drive-storage';
import { PersonalDrive } from './application/personal-drive';
import { PersonalDriveController } from './presentation/personal-drive.controller';
import { GoogleTokenVerifier } from './infrastructure/google-identity-verifier';
import { GoogleDriveChangesController } from './presentation/google-drive-changes.controller';
import { PersonalDriveSyncWorker } from './personal-drive-sync-worker.service';
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
    AuthModule,
    PatientsModule,
    TypeOrmModule.forFeature([
      UserStorageIntegration,
      DriveMigrationItem,
      User,
      ClinicMembership,
      ClinicStorageIntegration,
      Clinic,
      Patient,
      PatientFile,
    ]),
  ],
  controllers: [
    PersonalDriveController,
    GoogleDriveIntegrationController,
    GoogleDriveChangesController,
  ],
  providers: [
    StorageService,
    GoogleTokenVerifier,
    PersonalDriveStorage,
    PersonalDriveSyncWorker,
    {
      provide: PersonalDrive,
      useFactory: (port: PersonalDriveStorage) => new PersonalDrive(port),
      inject: [PersonalDriveStorage],
    },
    LocalStorageProvider,
    GoogleDriveStorageProvider,
    StorageProviderRegistry,
    GoogleDriveIntegrationService,
    TokenEncryptionService,
  ],
  exports: [
    PersonalDriveStorage,
    StorageService,
    GoogleDriveStorageProvider,
    GoogleDriveIntegrationService,
    TokenEncryptionService,
    TypeOrmModule,
  ],
})
export class StorageModule {}
