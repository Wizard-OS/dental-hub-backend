import { Body, Controller, Delete, Get, Post, Query } from '@nestjs/common';
import {
  ApiBearerAuth,
  ApiOperation,
  ApiQuery,
  ApiResponse,
  ApiSecurity,
  ApiTags,
} from '@nestjs/swagger';

import {
  AuthClinic,
  ClinicRoles,
  GetClinicId,
  GetUser,
} from '../auth/decorators';
import { User } from '../auth/entities/user.entity';
import { ClinicMembershipRole } from '../clinic-memberships/interfaces/clinic-membership-role.enum';
import { GoogleDriveOAuthCallbackDto } from './dto/google-drive-oauth-callback.dto';
import { GoogleDriveIntegrationService } from './google-drive-integration.service';

@ApiTags('Integrations')
@ApiBearerAuth()
@ApiSecurity('x-clinic-id')
@Controller('integrations/google-drive')
@AuthClinic()
@ClinicRoles(ClinicMembershipRole.owner, ClinicMembershipRole.admin)
export class GoogleDriveIntegrationController {
  constructor(
    private readonly googleDriveIntegrationService: GoogleDriveIntegrationService,
  ) {}

  @Get('status')
  @ApiOperation({ summary: 'Obtener estado de integración Google Drive' })
  @ApiResponse({ status: 200, description: 'Estado de Google Drive' })
  getStatus(@GetClinicId() clinicId: string) {
    return this.googleDriveIntegrationService.getStatus(clinicId);
  }

  @Get('oauth-url')
  @ApiOperation({ summary: 'Generar URL OAuth de Google Drive' })
  @ApiQuery({ name: 'redirectUri', required: true })
  @ApiResponse({ status: 200, description: 'URL OAuth generada' })
  getOAuthUrl(
    @GetUser() user: User,
    @GetClinicId() clinicId: string,
    @Query('redirectUri') redirectUri?: string,
  ) {
    return this.googleDriveIntegrationService.buildOAuthUrl(
      clinicId,
      user.id,
      redirectUri,
    );
  }

  @Post('oauth-callback')
  @ApiOperation({ summary: 'Conectar Google Drive con código OAuth' })
  @ApiResponse({ status: 201, description: 'Google Drive conectado' })
  connect(
    @GetUser() user: User,
    @GetClinicId() clinicId: string,
    @Body() dto: GoogleDriveOAuthCallbackDto,
  ) {
    return this.googleDriveIntegrationService.connect(
      clinicId,
      user.id,
      dto.code,
      dto.redirectUri,
      dto.state,
    );
  }

  @Delete('disconnect')
  @ApiOperation({ summary: 'Desconectar Google Drive' })
  @ApiResponse({ status: 200, description: 'Google Drive desconectado' })
  disconnect(@GetClinicId() clinicId: string) {
    return this.googleDriveIntegrationService.disconnect(clinicId);
  }

  @Post('sync')
  @ApiOperation({ summary: 'Sincronizar archivos desde Google Drive' })
  @ApiResponse({ status: 201, description: 'Sincronización ejecutada' })
  sync(@GetClinicId() clinicId: string) {
    return this.googleDriveIntegrationService.sync(clinicId);
  }
}
