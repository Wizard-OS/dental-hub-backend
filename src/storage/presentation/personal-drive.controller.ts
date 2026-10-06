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
import { GoogleAuthenticationError } from '../../auth/domain/google-identity';
import { PersonalDrive } from '../application/personal-drive';
import { PersonalDriveError } from '../domain/personal-drive';

class ConnectDriveDto {
  @ApiProperty() @IsString() @IsNotEmpty() @MaxLength(16384) idToken: string;
  @ApiProperty()
  @IsString()
  @IsNotEmpty()
  @MaxLength(4096)
  serverAuthCode: string;
}
class MigrateDriveDto {
  @ApiPropertyOptional() @IsOptional() @IsBoolean() retry?: boolean;
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
    return this.guard(() =>
      this.drive.connect(user.id, dto.idToken, dto.serverAuthCode),
    );
  }
  @Delete('disconnect')
  @Auth()
  async disconnect(@GetUser() user: User) {
    await this.guard(() => this.drive.disconnect(user.id));
    return { message: 'Google Drive disconnected. Files remain in Drive.' };
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
      if (
        error instanceof PersonalDriveError ||
        error instanceof GoogleAuthenticationError
      )
        throw new ConflictException({
          code: error.code,
          message: error.message,
        });
      throw error;
    }
  }
}
