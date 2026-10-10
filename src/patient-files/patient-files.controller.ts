import { i18nValidationMessage } from 'nestjs-i18n';
import { apiMessage } from '../common/i18n/api-message';
import { pipeline } from 'stream/promises';
import {
  Body,
  Controller,
  Delete,
  Get,
  Param,
  Patch,
  Post,
  Req,
  Res,
  UploadedFile,
  UseInterceptors,
} from '@nestjs/common';
import { Throttle } from '@nestjs/throttler';
import type { Request } from 'express';
import type { Response } from 'express';
import type { Express } from 'express';
import {
  ApiBearerAuth,
  ApiBody,
  ApiConsumes,
  ApiOperation,
  ApiParam,
  ApiPropertyOptional,
  ApiResponse,
  ApiSecurity,
  ApiTags,
} from '@nestjs/swagger';
import { IsBoolean, IsOptional } from 'class-validator';

import { PatientFilesService } from './patient-files.service';
import { CreatePatientFileDto } from './dto/create-patient-file.dto';
import {
  createUploadInterceptor,
  timestampedUploadName,
} from '../common/files/upload-interceptors';
import { buildRequestBaseUrl } from '../common/http/request-url';
import {
  AuthClinic,
  ClinicRoles,
  GetClinicId,
  GetClinicMembershipId,
  GetClinicMembershipRole,
  GetClinicPermissions,
  GetUser,
} from '../auth/decorators';
import { User } from '../auth/entities/user.entity';
import { ClinicMembershipRole } from '../clinic-memberships/interfaces/clinic-membership-role.enum';
import { ClinicAccessContext } from '../patients/services/patient-access.service';
import { ImportPatientFileFromDriveDto } from './dto/import-patient-file-from-drive.dto';
import { UpdatePatientFileDto } from './dto/update-patient-file.dto';

class DeletePatientFileDto {
  @ApiPropertyOptional({
    description: 'Confirm moving this Google Drive file into Drive Trash.',
  })
  @IsOptional()
  @IsBoolean({ message: i18nValidationMessage('validation.isBoolean') })
  confirmDriveTrash?: boolean;
}

@ApiTags('Patient Files')
@ApiBearerAuth()
@ApiSecurity('x-clinic-id')
@Controller()
@AuthClinic()
@ClinicRoles(
  ClinicMembershipRole.owner,
  ClinicMembershipRole.admin,
  ClinicMembershipRole.odontologist,
  ClinicMembershipRole.specialist,
  ClinicMembershipRole.receptionist,
  ClinicMembershipRole.assistant,
)
export class PatientFilesController {
  constructor(private readonly patientFilesService: PatientFilesService) {}

  @Post('patients/:patientId/files')
  @Throttle({ default: { limit: 20, ttl: 60_000 } })
  @ApiOperation({ summary: 'Adjuntar archivo a paciente' })
  @ApiConsumes('multipart/form-data')
  @ApiParam({ name: 'patientId', description: 'UUID del paciente' })
  @ApiBody({
    schema: {
      type: 'object',
      properties: {
        file: { type: 'string', format: 'binary' },
        type: { type: 'string' },
        description: { type: 'string' },
        appointmentId: { type: 'string' },
        clinicalNoteId: { type: 'string' },
        treatmentId: { type: 'string' },
      },
    },
  })
  @ApiResponse({ status: 201, description: 'Archivo adjuntado' })
  @UseInterceptors(
    createUploadInterceptor({
      directory: 'patient-files',
      maxSizeMb: 10,
      allowDocuments: true,
      filename: timestampedUploadName,
    }),
  )
  create(
    @GetClinicId() clinicId: string,
    @GetClinicMembershipId() membershipId: string,
    @GetClinicMembershipRole() role: ClinicMembershipRole,
    @GetClinicPermissions() permissionsJson: Record<string, boolean>,
    @Param('patientId') patientId: string,
    @UploadedFile() file: Express.Multer.File,
    @Body() dto: CreatePatientFileDto,
    @Req() request: Request,
  ) {
    const baseUrl = buildRequestBaseUrl(request);
    return this.patientFilesService.create(
      this.context(clinicId, membershipId, role, permissionsJson),
      patientId,
      membershipId,
      file,
      baseUrl,
      dto,
    );
  }

  @Post('patients/:patientId/files/import-from-drive')
  @ApiOperation({ summary: 'Importar archivo seleccionado de Google Drive' })
  @ApiParam({ name: 'patientId', description: 'UUID del paciente' })
  @ApiResponse({ status: 201, description: 'Archivo importado al paciente' })
  importFromDrive(
    @GetUser() user: User,
    @GetClinicId() clinicId: string,
    @GetClinicMembershipId() membershipId: string,
    @GetClinicMembershipRole() role: ClinicMembershipRole,
    @GetClinicPermissions() permissionsJson: Record<string, boolean>,
    @Param('patientId') patientId: string,
    @Body() dto: ImportPatientFileFromDriveDto,
  ) {
    return this.patientFilesService.importFromDrive(
      this.context(clinicId, membershipId, role, permissionsJson),
      patientId,
      membershipId,
      user,
      dto,
    );
  }

  @Post('patients/:patientId/profile-photo')
  @Throttle({ default: { limit: 20, ttl: 60_000 } })
  @ApiOperation({ summary: 'Subir foto de perfil del paciente' })
  @ApiConsumes('multipart/form-data')
  @ApiParam({ name: 'patientId', description: 'UUID del paciente' })
  @ApiBody({
    schema: {
      type: 'object',
      properties: {
        file: { type: 'string', format: 'binary' },
      },
    },
  })
  @ApiResponse({ status: 201, description: 'Foto de perfil actualizada' })
  @UseInterceptors(
    createUploadInterceptor({
      directory: 'patient-files',
      maxSizeMb: 10,
      imageOnlyMessage: apiMessage(
        'api.messages.profile_photo_must_be_an_image',
      ),
      filename: timestampedUploadName,
    }),
  )
  createProfilePhoto(
    @GetClinicId() clinicId: string,
    @GetClinicMembershipId() membershipId: string,
    @GetClinicMembershipRole() role: ClinicMembershipRole,
    @GetClinicPermissions() permissionsJson: Record<string, boolean>,
    @Param('patientId') patientId: string,
    @UploadedFile() file: Express.Multer.File,
    @Req() request: Request,
  ) {
    const baseUrl = buildRequestBaseUrl(request);
    return this.patientFilesService.createProfilePhoto(
      this.context(clinicId, membershipId, role, permissionsJson),
      patientId,
      membershipId,
      file,
      baseUrl,
    );
  }

  @Get('patients/:patientId/files')
  @ApiOperation({ summary: 'Listar archivos del paciente' })
  @ApiParam({ name: 'patientId', description: 'UUID del paciente' })
  @ApiResponse({ status: 200, description: 'Archivos del paciente' })
  findAllByPatient(
    @GetClinicId() clinicId: string,
    @GetClinicMembershipId() membershipId: string,
    @GetClinicMembershipRole() role: ClinicMembershipRole,
    @GetClinicPermissions() permissionsJson: Record<string, boolean>,
    @Param('patientId') patientId: string,
  ) {
    return this.patientFilesService.findAllByPatient(
      this.context(clinicId, membershipId, role, permissionsJson),
      patientId,
    );
  }

  @Get('patient-files/:id')
  @ApiOperation({ summary: 'Obtener archivo de paciente por ID' })
  @ApiParam({ name: 'id', description: 'UUID del archivo' })
  @ApiResponse({ status: 200, description: 'Archivo encontrado' })
  findOne(
    @GetClinicId() clinicId: string,
    @GetClinicMembershipId() membershipId: string,
    @GetClinicMembershipRole() role: ClinicMembershipRole,
    @GetClinicPermissions() permissionsJson: Record<string, boolean>,
    @Param('id') id: string,
  ) {
    return this.patientFilesService.findOne(
      this.context(clinicId, membershipId, role, permissionsJson),
      id,
    );
  }

  @Patch('patient-files/:id')
  @ApiOperation({ summary: 'Actualizar metadatos del archivo de paciente' })
  @ApiParam({ name: 'id', description: 'UUID del archivo' })
  @ApiResponse({ status: 200, description: 'Metadatos actualizados' })
  updateMetadata(
    @GetClinicId() clinicId: string,
    @GetClinicMembershipId() membershipId: string,
    @GetClinicMembershipRole() role: ClinicMembershipRole,
    @GetClinicPermissions() permissionsJson: Record<string, boolean>,
    @Param('id') id: string,
    @Body() dto: UpdatePatientFileDto,
  ) {
    return this.patientFilesService.updateMetadata(
      this.context(clinicId, membershipId, role, permissionsJson),
      id,
      dto,
    );
  }

  @Post('patient-files/:id/restore-from-drive')
  @ApiOperation({ summary: 'Restaurar archivo en revisión desde Google Drive' })
  @ApiParam({ name: 'id', description: 'UUID del archivo' })
  @ApiResponse({ status: 200, description: 'Archivo restaurado' })
  restoreFromDrive(
    @GetClinicId() clinicId: string,
    @GetClinicMembershipId() membershipId: string,
    @GetClinicMembershipRole() role: ClinicMembershipRole,
    @GetClinicPermissions() permissionsJson: Record<string, boolean>,
    @Param('id') id: string,
  ) {
    return this.patientFilesService.restoreFromDrive(
      this.context(clinicId, membershipId, role, permissionsJson),
      id,
    );
  }

  @Get('patient-files/:id/drive-versions')
  @ApiOperation({ summary: 'Listar versiones anteriores de Google Drive' })
  @ApiParam({ name: 'id', description: 'UUID del archivo' })
  listDriveRevisions(
    @GetClinicId() clinicId: string,
    @GetClinicMembershipId() membershipId: string,
    @GetClinicMembershipRole() role: ClinicMembershipRole,
    @GetClinicPermissions() permissionsJson: Record<string, boolean>,
    @Param('id') id: string,
  ) {
    return this.patientFilesService.listDriveRevisions(
      this.context(clinicId, membershipId, role, permissionsJson),
      id,
    );
  }

  @Get('patient-files/:id/drive-versions/:revisionId/download')
  @ApiOperation({ summary: 'Descargar una versión anterior del archivo' })
  @ApiParam({ name: 'id', description: 'UUID del archivo' })
  @ApiParam({ name: 'revisionId', description: 'ID de la versión de Drive' })
  async downloadDriveRevision(
    @GetClinicId() clinicId: string,
    @GetClinicMembershipId() membershipId: string,
    @GetClinicMembershipRole() role: ClinicMembershipRole,
    @GetClinicPermissions() permissionsJson: Record<string, boolean>,
    @Param('id') id: string,
    @Param('revisionId') revisionId: string,
    @Res() response: Response,
  ) {
    const revision = await this.patientFilesService.downloadDriveRevision(
      this.context(clinicId, membershipId, role, permissionsJson),
      id,
      revisionId,
    );
    response.setHeader('Content-Type', revision.mimeType);
    response.setHeader(
      'Content-Disposition',
      `attachment; filename="${encodeURIComponent(revision.originalName)}"`,
    );
    response.setHeader('Cache-Control', 'private, no-store');
    return pipeline(revision.stream, response);
  }

  @Get('patient-files/:id/download')
  @ApiOperation({ summary: 'Descargar archivo de paciente' })
  @ApiParam({ name: 'id', description: 'UUID del archivo' })
  @ApiResponse({ status: 200, description: 'Archivo descargado' })
  async download(
    @GetClinicId() clinicId: string,
    @GetClinicMembershipId() membershipId: string,
    @GetClinicMembershipRole() role: ClinicMembershipRole,
    @GetClinicPermissions() permissionsJson: Record<string, boolean>,
    @Param('id') id: string,
    @Res() response: Response,
  ) {
    const file = await this.patientFilesService.getDownload(
      this.context(clinicId, membershipId, role, permissionsJson),
      id,
    );

    response.setHeader('Content-Type', file.mimeType);
    response.setHeader(
      'Content-Disposition',
      `attachment; filename="${encodeURIComponent(file.originalName)}"`,
    );
    response.setHeader('Cache-Control', 'private, no-store');
    if (file.stream) return pipeline(file.stream, response);
    return response.sendFile(file.path);
  }

  @Delete('patient-files/:id')
  @ApiOperation({ summary: 'Eliminar archivo de paciente' })
  @ApiBody({ type: DeletePatientFileDto, required: false })
  @ApiParam({ name: 'id', description: 'UUID del archivo' })
  @ApiResponse({ status: 200, description: 'Archivo eliminado' })
  remove(
    @GetClinicId() clinicId: string,
    @GetClinicMembershipId() membershipId: string,
    @GetClinicMembershipRole() role: ClinicMembershipRole,
    @GetClinicPermissions() permissionsJson: Record<string, boolean>,
    @Param('id') id: string,
    @Body() dto?: DeletePatientFileDto,
  ) {
    return this.patientFilesService.remove(
      this.context(clinicId, membershipId, role, permissionsJson),
      id,
      dto?.confirmDriveTrash ?? false,
    );
  }

  private context(
    clinicId: string,
    membershipId: string,
    role: ClinicMembershipRole,
    permissionsJson: Record<string, boolean> | undefined,
  ): ClinicAccessContext {
    return { clinicId, membershipId, role, permissionsJson };
  }
}
