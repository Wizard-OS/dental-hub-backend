import {
  Body,
  Controller,
  Delete,
  Get,
  Param,
  ParseUUIDPipe,
  Patch,
  Post,
} from '@nestjs/common';
import {
  ApiBearerAuth,
  ApiOperation,
  ApiParam,
  ApiResponse,
  ApiSecurity,
  ApiTags,
} from '@nestjs/swagger';

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
import { ClinicalRecordsService } from './clinical-records.service';
import { CreateClinicalRecordDto } from './dto/create-clinical-record.dto';
import { UpdateClinicalRecordDto } from './dto/update-clinical-record.dto';

@ApiTags('Clinical Records')
@ApiBearerAuth()
@ApiSecurity('x-clinic-id')
@Controller('clinical-records')
@AuthClinic()
@ClinicRoles(
  ClinicMembershipRole.owner,
  ClinicMembershipRole.admin,
  ClinicMembershipRole.odontologist,
  ClinicMembershipRole.specialist,
)
export class ClinicalRecordsController {
  constructor(
    private readonly clinicalRecordsService: ClinicalRecordsService,
  ) {}

  @Post()
  @ApiOperation({ summary: 'Crear registro clínico' })
  @ApiResponse({ status: 201, description: 'Registro clínico creado' })
  create(
    @GetClinicId() clinicId: string,
    @GetClinicMembershipId() membershipId: string,
    @GetClinicMembershipRole() role: ClinicMembershipRole,
    @GetClinicPermissions() permissionsJson: Record<string, boolean>,
    @Body() createClinicalRecordDto: CreateClinicalRecordDto,
  ) {
    return this.clinicalRecordsService.create(
      this.context(clinicId, membershipId, role, permissionsJson),
      createClinicalRecordDto,
    );
  }

  @Get()
  @ApiOperation({ summary: 'Listar registros clínicos' })
  @ApiResponse({ status: 200, description: 'Lista de registros clínicos' })
  findAll(
    @GetClinicId() clinicId: string,
    @GetClinicMembershipId() membershipId: string,
    @GetClinicMembershipRole() role: ClinicMembershipRole,
    @GetClinicPermissions() permissionsJson: Record<string, boolean>,
  ) {
    return this.clinicalRecordsService.findAll(
      this.context(clinicId, membershipId, role, permissionsJson),
    );
  }

  @Get('patient/:patientId')
  @ApiOperation({ summary: 'Obtener registro clínico por ID' })
  @ApiParam({ name: 'patientId', description: 'UUID del registro clínico' })
  @ApiResponse({ status: 200, description: 'Registro clínico encontrado' })
  findByPatient(
    @GetClinicId() clinicId: string,
    @GetClinicMembershipId() membershipId: string,
    @GetClinicMembershipRole() role: ClinicMembershipRole,
    @GetClinicPermissions() permissionsJson: Record<string, boolean>,
    @Param('patientId', ParseUUIDPipe) patientId: string,
  ) {
    return this.clinicalRecordsService.findByPatient(
      this.context(clinicId, membershipId, role, permissionsJson),
      patientId,
    );
  }

  @Get(':id')
  @ApiOperation({ summary: 'Obtener registro clínico por ID' })
  @ApiParam({ name: 'id', description: 'UUID del registro clínico' })
  @ApiResponse({ status: 200, description: 'Registro clínico encontrado' })
  findOne(
    @GetClinicId() clinicId: string,
    @GetClinicMembershipId() membershipId: string,
    @GetClinicMembershipRole() role: ClinicMembershipRole,
    @GetClinicPermissions() permissionsJson: Record<string, boolean>,
    @Param('id') id: string,
  ) {
    return this.clinicalRecordsService.findOne(
      this.context(clinicId, membershipId, role, permissionsJson),
      id,
    );
  }

  @Patch(':id')
  @ApiOperation({ summary: 'Actualizar registro clínico' })
  @ApiParam({ name: 'id', description: 'UUID del registro clínico' })
  @ApiResponse({ status: 200, description: 'Registro clínico actualizado' })
  update(
    @GetClinicId() clinicId: string,
    @GetClinicMembershipId() membershipId: string,
    @GetClinicMembershipRole() role: ClinicMembershipRole,
    @GetClinicPermissions() permissionsJson: Record<string, boolean>,
    @Param('id') id: string,
    @Body() updateClinicalRecordDto: UpdateClinicalRecordDto,
  ) {
    return this.clinicalRecordsService.update(
      this.context(clinicId, membershipId, role, permissionsJson),
      id,
      updateClinicalRecordDto,
    );
  }

  @Delete(':id')
  @ApiOperation({ summary: 'Eliminar registro clínico' })
  @ApiParam({ name: 'id', description: 'UUID del registro clínico' })
  @ApiResponse({ status: 200, description: 'Registro clínico eliminado' })
  remove(
    @GetClinicId() clinicId: string,
    @GetClinicMembershipId() membershipId: string,
    @GetClinicMembershipRole() role: ClinicMembershipRole,
    @GetClinicPermissions() permissionsJson: Record<string, boolean>,
    @Param('id') id: string,
  ) {
    return this.clinicalRecordsService.remove(
      this.context(clinicId, membershipId, role, permissionsJson),
      id,
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
