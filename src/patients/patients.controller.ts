import {
  Body,
  Controller,
  Delete,
  Get,
  Param,
  Patch,
  Post,
  Query,
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
import { CreatePatientDto } from './dto/create-patient.dto';
import { QueryPatientsDto } from './dto/query-patients.dto';
import { UpdatePatientDto } from './dto/update-patient.dto';
import { PatientsService } from './patients.service';
import { ClinicAccessContext } from './services/patient-access.service';

@ApiTags('Patients')
@ApiBearerAuth()
@ApiSecurity('x-clinic-id')
@Controller('patients')
@AuthClinic()
@ClinicRoles(
  ClinicMembershipRole.owner,
  ClinicMembershipRole.admin,
  ClinicMembershipRole.odontologist,
  ClinicMembershipRole.specialist,
  ClinicMembershipRole.receptionist,
  ClinicMembershipRole.assistant,
)
export class PatientsController {
  constructor(private readonly patientService: PatientsService) {}

  @Post('create')
  @ApiOperation({ summary: 'Crear paciente' })
  @ApiResponse({ status: 201, description: 'Paciente creado' })
  create(
    @GetClinicId() clinicId: string,
    @GetClinicMembershipId() membershipId: string,
    @GetClinicMembershipRole() role: ClinicMembershipRole,
    @GetClinicPermissions() permissionsJson: Record<string, boolean>,
    @Body() createPatientDto: CreatePatientDto,
  ) {
    return this.patientService.create(
      this.context(clinicId, membershipId, role, permissionsJson),
      createPatientDto,
    );
  }

  @Get()
  @ApiOperation({ summary: 'Listar pacientes (paginado)' })
  @ApiResponse({ status: 200, description: 'Lista de pacientes' })
  findAll(
    @GetClinicId() clinicId: string,
    @GetClinicMembershipId() membershipId: string,
    @GetClinicMembershipRole() role: ClinicMembershipRole,
    @GetClinicPermissions() permissionsJson: Record<string, boolean>,
    @Query() paginationDto: QueryPatientsDto,
  ) {
    return this.patientService.findAll(
      this.context(clinicId, membershipId, role, permissionsJson),
      paginationDto,
    );
  }

  @Get(':term')
  @ApiOperation({ summary: 'Buscar paciente por ID o término' })
  @ApiParam({ name: 'term', description: 'UUID o término de búsqueda' })
  @ApiResponse({ status: 200, description: 'Paciente encontrado' })
  @ApiResponse({ status: 404, description: 'Paciente no encontrado' })
  findOne(
    @GetClinicId() clinicId: string,
    @GetClinicMembershipId() membershipId: string,
    @GetClinicMembershipRole() role: ClinicMembershipRole,
    @GetClinicPermissions() permissionsJson: Record<string, boolean>,
    @Param('term') term: string,
  ) {
    return this.patientService.findOnePlain(
      this.context(clinicId, membershipId, role, permissionsJson),
      term,
    );
  }

  @Patch(':id')
  @ApiOperation({ summary: 'Actualizar paciente' })
  @ApiParam({ name: 'id', description: 'UUID del paciente' })
  @ApiResponse({ status: 200, description: 'Paciente actualizado' })
  update(
    @GetClinicId() clinicId: string,
    @GetClinicMembershipId() membershipId: string,
    @GetClinicMembershipRole() role: ClinicMembershipRole,
    @GetClinicPermissions() permissionsJson: Record<string, boolean>,
    @Param('id') id: string,
    @Body() updatePatientDto: UpdatePatientDto,
  ) {
    return this.patientService.update(
      this.context(clinicId, membershipId, role, permissionsJson),
      id,
      updatePatientDto,
    );
  }

  @Delete(':id')
  @ApiOperation({ summary: 'Archivar paciente' })
  @ApiParam({ name: 'id', description: 'UUID del paciente' })
  @ApiResponse({ status: 200, description: 'Paciente archivado' })
  remove(
    @GetClinicId() clinicId: string,
    @GetClinicMembershipId() membershipId: string,
    @GetClinicMembershipRole() role: ClinicMembershipRole,
    @GetClinicPermissions() permissionsJson: Record<string, boolean>,
    @Param('id') id: string,
  ) {
    return this.patientService.remove(
      this.context(clinicId, membershipId, role, permissionsJson),
      id,
    );
  }

  @Patch(':id/reactivate')
  @ApiOperation({ summary: 'Reactivar paciente archivado' })
  @ApiParam({ name: 'id', description: 'UUID del paciente' })
  @ApiResponse({ status: 200, description: 'Paciente reactivado' })
  reactivate(
    @GetClinicId() clinicId: string,
    @GetClinicMembershipId() membershipId: string,
    @GetClinicMembershipRole() role: ClinicMembershipRole,
    @GetClinicPermissions() permissionsJson: Record<string, boolean>,
    @Param('id') id: string,
  ) {
    return this.patientService.reactivate(
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
