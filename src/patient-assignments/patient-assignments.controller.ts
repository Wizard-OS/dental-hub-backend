import {
  Body,
  Controller,
  Delete,
  Get,
  HttpStatus,
  Param,
  Post,
  Query,
} from '@nestjs/common';
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
  GetClinicMembershipId,
} from '../auth/decorators';
import { ClinicMembershipRole } from '../clinic-memberships/interfaces/clinic-membership-role.enum';
import { CreatePatientAssignmentDto } from './dto/create-patient-assignment.dto';
import { PatientAssignmentsService } from './patient-assignments.service';

@ApiTags('Patient Assignments')
@ApiBearerAuth()
@ApiSecurity('x-clinic-id')
@Controller('patient-assignments')
@AuthClinic()
@ClinicRoles(ClinicMembershipRole.owner, ClinicMembershipRole.admin)
export class PatientAssignmentsController {
  constructor(
    private readonly patientAssignmentsService: PatientAssignmentsService,
  ) {}

  @Get()
  @ApiOperation({ summary: 'Listar asignaciones activas de pacientes' })
  @ApiQuery({ name: 'patientId', required: false })
  @ApiResponse({ status: HttpStatus.OK, description: 'Lista de asignaciones' })
  findAll(
    @GetClinicId() clinicId: string,
    @Query('patientId') patientId?: string,
  ) {
    return this.patientAssignmentsService.findAll(clinicId, patientId);
  }

  @Post()
  @ApiOperation({ summary: 'Asignar paciente a profesional secundario' })
  @ApiResponse({ status: HttpStatus.CREATED, description: 'Asignación creada' })
  create(
    @GetClinicId() clinicId: string,
    @GetClinicMembershipId() membershipId: string,
    @Body() dto: CreatePatientAssignmentDto,
  ) {
    return this.patientAssignmentsService.create(clinicId, membershipId, dto);
  }

  @Delete(':id')
  @ApiOperation({ summary: 'Revocar asignación de paciente' })
  @ApiResponse({ status: HttpStatus.OK, description: 'Asignación revocada' })
  revoke(
    @GetClinicId() clinicId: string,
    @GetClinicMembershipId() membershipId: string,
    @Param('id') id: string,
  ) {
    return this.patientAssignmentsService.revoke(clinicId, id, membershipId);
  }
}
