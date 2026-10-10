import { i18nValidationMessage } from 'nestjs-i18n';
import { apiMessage, type ApiMessageKey } from '../../common/i18n/api-message';
import {
  Body,
  ConflictException,
  Controller,
  Delete,
  Get,
  Post,
} from '@nestjs/common';
import {
  IsBoolean,
  IsNotEmpty,
  IsOptional,
  IsString,
  MaxLength,
} from 'class-validator';
import {
  ApiBearerAuth,
  ApiProperty,
  ApiPropertyOptional,
  ApiTags,
} from '@nestjs/swagger';
import { Throttle } from '@nestjs/throttler';
import {
  Auth,
  AuthClinic,
  GetClinicId,
  GetClinicMembershipId,
  GetClinicMembershipRole,
  GetClinicPermissions,
  GetUser,
} from '../../auth/decorators';
import { User } from '../../auth/entities/user.entity';
import { ClinicMembershipRole } from '../../clinic-memberships/interfaces/clinic-membership-role.enum';
import { PersonalDrive } from '../application/personal-drive';
import { PersonalDriveError } from '../domain/personal-drive';

class ConnectDriveDto {
  @ApiProperty()
  @IsString({ message: i18nValidationMessage('validation.isString') })
  @IsNotEmpty({ message: i18nValidationMessage('validation.isNotEmpty') })
  @MaxLength(4096, { message: i18nValidationMessage('validation.maxLength') })
  serverAuthCode: string;
}
class MigrateDriveDto {
  @ApiPropertyOptional()
  @IsOptional()
  @IsBoolean({ message: i18nValidationMessage('validation.isBoolean') })
  retry?: boolean;
}
class DisconnectDriveDto {
  @ApiPropertyOptional({
    description:
      'Confirm patient files owned by this Drive have been backed up or transferred.',
  })
  @IsOptional()
  @IsBoolean({ message: i18nValidationMessage('validation.isBoolean') })
  confirmFilesBackedUp?: boolean;
}

@ApiTags('Integrations')
@ApiBearerAuth()
@Controller('integrations/google-drive/me')
export class PersonalDriveController {
  constructor(private readonly drive: PersonalDrive) {}
  @Get('status')
  @Auth()
  status(@GetUser() user: User) {
    return this.guard(() => this.drive.status(user.id));
  }
  @Post('connect')
  @Auth()
  @Throttle({ default: { limit: 5, ttl: 60_000 } })
  connect(@GetUser() user: User, @Body() dto: ConnectDriveDto) {
    return this.guard(() => this.drive.connect(user.id, dto.serverAuthCode));
  }
  @Delete('disconnect')
  @Auth()
  async disconnect(@GetUser() user: User, @Body() dto?: DisconnectDriveDto) {
    await this.guard(() =>
      this.drive.disconnect(user.id, dto?.confirmFilesBackedUp ?? false),
    );
    return {
      message: apiMessage(
        'api.messages.google_drive_disconnected_files_remain_in_drive',
      ),
    };
  }
  @Get('migration')
  @AuthClinic()
  migrationStatus(
    @GetUser() user: User,
    @GetClinicId() clinicId: string,
    @GetClinicMembershipId() membershipId: string,
    @GetClinicMembershipRole() role: ClinicMembershipRole,
    @GetClinicPermissions() permissionsJson: Record<string, boolean>,
  ) {
    return this.guard(() =>
      this.drive.migrationStatus(user.id, {
        clinicId,
        membershipId,
        role,
        permissionsJson,
      }),
    );
  }
  @Post('migration')
  @AuthClinic()
  migrate(
    @GetUser() user: User,
    @GetClinicId() clinicId: string,
    @GetClinicMembershipId() membershipId: string,
    @GetClinicMembershipRole() role: ClinicMembershipRole,
    @GetClinicPermissions() permissionsJson: Record<string, boolean>,
    @Body() dto: MigrateDriveDto,
  ) {
    return this.guard(() =>
      this.drive.migrate(
        user.id,
        { clinicId, membershipId, role, permissionsJson },
        dto.retry ?? false,
      ),
    );
  }
  @Post('sync')
  @AuthClinic()
  sync(
    @GetUser() user: User,
    @GetClinicId() clinicId: string,
    @GetClinicMembershipId() membershipId: string,
    @GetClinicMembershipRole() role: ClinicMembershipRole,
    @GetClinicPermissions() permissionsJson: Record<string, boolean>,
  ) {
    return this.guard(() =>
      this.drive.sync(user.id, {
        clinicId,
        membershipId,
        role,
        permissionsJson,
      }),
    );
  }
  private async guard<T>(action: () => Promise<T>): Promise<T> {
    try {
      return await action();
    } catch (error) {
      if (error instanceof PersonalDriveError)
        throw new ConflictException({
          code: error.code,
          message: apiMessage(driveErrorMessages[error.code] ?? 'api.http.409'),
        });
      throw error;
    }
  }
}

const driveErrorMessages: Record<string, ApiMessageKey> = {
  GOOGLE_NOT_CONFIGURED: 'api.drive.GOOGLE_NOT_CONFIGURED',
  INVALID_GOOGLE_TOKEN: 'api.drive.INVALID_GOOGLE_TOKEN',
  DRIVE_SCOPE_REQUIRED: 'api.drive.DRIVE_SCOPE_REQUIRED',
};
