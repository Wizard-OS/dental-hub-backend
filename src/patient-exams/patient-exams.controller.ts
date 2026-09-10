import { QueryPatientExamsDto } from './dto/query-patient-exams.dto';
import {
  Body,
  Query,
  ParseUUIDPipe,
  Controller,
  Delete,
  Get,
  Param,
  Patch,
  Post,
} from '@nestjs/common';
import {
  ApiTags,
  ApiOperation,
  ApiResponse,
  ApiBearerAuth,
  ApiSecurity,
  ApiParam,
} from '@nestjs/swagger';

import { PatientExamsService } from './patient-exams.service';
import { CreatePatientExamDto } from './dto/create-patient-exam.dto';
import { UpdatePatientExamDto } from './dto/create-patient-exam.dto';
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

@ApiTags('Patient Exams')
@ApiBearerAuth()
@ApiSecurity('x-clinic-id')
@Controller('patients/:patientId/exams')
@AuthClinic()
@ClinicRoles(
  ClinicMembershipRole.owner,
  ClinicMembershipRole.admin,
  ClinicMembershipRole.odontologist,
  ClinicMembershipRole.specialist,
)
export class PatientExamsController {
  constructor(private readonly patientExamsService: PatientExamsService) {}

  @Post()
  @ApiOperation({ summary: 'Crear examen complementario' })
  @ApiResponse({ status: 201, description: 'Examen complementario creado' })
  create(
    @Param('patientId', ParseUUIDPipe) patientId: string,
    @GetClinicId() clinicId: string,
    @GetClinicMembershipId() membershipId: string,
    @GetClinicMembershipRole() role: ClinicMembershipRole,
    @GetClinicPermissions() permissionsJson: Record<string, boolean>,
    @Body() createPatientExamDto: CreatePatientExamDto,
  ) {
    return this.patientExamsService.create(
      this.context(clinicId, membershipId, role, permissionsJson),
      patientId,
      createPatientExamDto,
    );
  }

  @Get()
  @ApiOperation({ summary: 'Listar exámenes complementarios' })
  @ApiResponse({
    status: 200,
    description: 'Lista de exámenes complementarios',
  })
  findAll(
    @Query() query: QueryPatientExamsDto,
    @Param('patientId', ParseUUIDPipe) patientId: string,
    @GetClinicId() clinicId: string,
    @GetClinicMembershipId() membershipId: string,
    @GetClinicMembershipRole() role: ClinicMembershipRole,
    @GetClinicPermissions() permissionsJson: Record<string, boolean>,
  ) {
    return this.patientExamsService.findAll(
      this.context(clinicId, membershipId, role, permissionsJson),
      patientId,
      query,
    );
  }

  @Get(':id')
  @ApiOperation({ summary: 'Obtener examen complementario por ID' })
  @ApiParam({ name: 'id', description: 'UUID del examen complementario' })
  @ApiResponse({ status: 200, description: 'Examen complementario encontrado' })
  findOne(
    @Param('patientId', ParseUUIDPipe) patientId: string,
    @GetClinicId() clinicId: string,
    @GetClinicMembershipId() membershipId: string,
    @GetClinicMembershipRole() role: ClinicMembershipRole,
    @GetClinicPermissions() permissionsJson: Record<string, boolean>,
    @Param('id', ParseUUIDPipe) id: string,
  ) {
    return this.patientExamsService.findOne(
      this.context(clinicId, membershipId, role, permissionsJson),
      patientId,
      id,
    );
  }

  @Patch(':id')
  @ApiOperation({ summary: 'Actualizar examen complementario' })
  @ApiParam({ name: 'id', description: 'UUID del examen complementario' })
  @ApiResponse({
    status: 200,
    description: 'Examen complementario actualizado',
  })
  update(
    @Param('patientId', ParseUUIDPipe) patientId: string,
    @GetClinicId() clinicId: string,
    @GetClinicMembershipId() membershipId: string,
    @GetClinicMembershipRole() role: ClinicMembershipRole,
    @GetClinicPermissions() permissionsJson: Record<string, boolean>,
    @Param('id', ParseUUIDPipe) id: string,
    @Body() updatePatientExamDto: UpdatePatientExamDto,
  ) {
    return this.patientExamsService.update(
      this.context(clinicId, membershipId, role, permissionsJson),
      patientId,
      id,
      updatePatientExamDto,
    );
  }

  @Delete(':id')
  @ApiOperation({ summary: 'Eliminar examen complementario' })
  @ApiParam({ name: 'id', description: 'UUID del examen complementario' })
  @ApiResponse({ status: 200, description: 'Examen complementario eliminado' })
  remove(
    @Param('patientId', ParseUUIDPipe) patientId: string,
    @GetClinicId() clinicId: string,
    @GetClinicMembershipId() membershipId: string,
    @GetClinicMembershipRole() role: ClinicMembershipRole,
    @GetClinicPermissions() permissionsJson: Record<string, boolean>,
    @Param('id', ParseUUIDPipe) id: string,
  ) {
    return this.patientExamsService.remove(
      this.context(clinicId, membershipId, role, permissionsJson),
      patientId,
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
