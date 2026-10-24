import {
  Body,
  Controller,
  Delete,
  Get,
  Param,
  Patch,
  Post,
  Req,
} from '@nestjs/common';
import {
  ApiBearerAuth,
  ApiOperation,
  ApiParam,
  ApiResponse,
  ApiSecurity,
  ApiTags,
} from '@nestjs/swagger';
import type { Request } from 'express';

import {
  AuthClinic,
  ClinicRoles,
  GetClinicId,
  GetClinicMembershipId,
  GetClinicMembershipRole,
  GetClinicPermissions,
} from '../auth/decorators';
import { ClinicMembershipRole } from '../clinic-memberships/interfaces/clinic-membership-role.enum';
import { ClinicAccessContext } from '../patients/services/patient-access.service';
import { GenerateOdontogramPdfDto } from './dto/generate-odontogram-pdf.dto';
import { UpdateOdontogramToothDto } from './dto/update-odontogram-tooth.dto';
import { OdontogramService } from './odontogram.service';

@ApiTags('Odontogram')
@ApiBearerAuth()
@ApiSecurity('x-clinic-id')
@Controller('patients/:patientId/odontogram')
@AuthClinic()
@ClinicRoles(
  ClinicMembershipRole.owner,
  ClinicMembershipRole.admin,
  ClinicMembershipRole.odontologist,
  ClinicMembershipRole.specialist,
)
export class OdontogramController {
  constructor(private readonly odontogramService: OdontogramService) {}

  @Get()
  @ApiOperation({ summary: 'Obtener odontograma actual del paciente' })
  @ApiParam({ name: 'patientId', description: 'UUID del paciente' })
  @ApiResponse({ status: 200, description: 'Odontograma del paciente' })
  findByPatient(
    @GetClinicId() clinicId: string,
    @GetClinicMembershipId() membershipId: string,
    @GetClinicMembershipRole() role: ClinicMembershipRole,
    @GetClinicPermissions() permissionsJson: Record<string, boolean>,
    @Param('patientId') patientId: string,
  ) {
    return this.odontogramService.findByPatient(
      this.context(clinicId, membershipId, role, permissionsJson),
      patientId,
    );
  }

  @Post('pdf')
  @ApiOperation({ summary: 'Generar y guardar PDF del odontograma' })
  @ApiParam({ name: 'patientId', description: 'UUID del paciente' })
  @ApiResponse({ status: 201, description: 'PDF generado como archivo' })
  generatePdf(
    @GetClinicId() clinicId: string,
    @GetClinicMembershipId() membershipId: string,
    @GetClinicMembershipRole() role: ClinicMembershipRole,
    @GetClinicPermissions() permissionsJson: Record<string, boolean>,
    @Param('patientId') patientId: string,
    @Body() dto: GenerateOdontogramPdfDto,
    @Req() request: Request,
  ) {
    const baseUrl = `${request.protocol}://${request.get('host')}`;

    return this.odontogramService.generatePdf(
      this.context(clinicId, membershipId, role, permissionsJson),
      patientId,
      membershipId,
      baseUrl,
      dto,
    );
  }

  @Patch('teeth/:toothCode')
  @ApiOperation({ summary: 'Actualizar estado de una pieza dental' })
  @ApiParam({ name: 'patientId', description: 'UUID del paciente' })
  @ApiParam({ name: 'toothCode', description: 'Código FDI de pieza dental' })
  @ApiResponse({ status: 200, description: 'Pieza actualizada' })
  updateTooth(
    @GetClinicId() clinicId: string,
    @GetClinicMembershipId() membershipId: string,
    @GetClinicMembershipRole() role: ClinicMembershipRole,
    @GetClinicPermissions() permissionsJson: Record<string, boolean>,
    @Param('patientId') patientId: string,
    @Param('toothCode') toothCode: string,
    @Body() dto: UpdateOdontogramToothDto,
  ) {
    return this.odontogramService.updateTooth(
      this.context(clinicId, membershipId, role, permissionsJson),
      patientId,
      toothCode,
      membershipId,
      dto,
    );
  }

  @Delete('entries/:entryId')
  @ApiOperation({ summary: 'Eliminar registro del odontograma' })
  @ApiParam({ name: 'patientId', description: 'UUID del paciente' })
  @ApiParam({ name: 'entryId', description: 'UUID del registro' })
  @ApiResponse({ status: 200, description: 'Registro eliminado' })
  removeEntry(
    @GetClinicId() clinicId: string,
    @GetClinicMembershipId() membershipId: string,
    @GetClinicMembershipRole() role: ClinicMembershipRole,
    @GetClinicPermissions() permissionsJson: Record<string, boolean>,
    @Param('patientId') patientId: string,
    @Param('entryId') entryId: string,
  ) {
    return this.odontogramService.removeEntry(
      this.context(clinicId, membershipId, role, permissionsJson),
      patientId,
      entryId,
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
