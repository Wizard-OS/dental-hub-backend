import {
  Body,
  Controller,
  Delete,
  Get,
  HttpStatus,
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
import { ListQueryDto } from '../common/dtos/list-query.dto';
import { ApiPaginatedResponse } from '../common/presentation/api-paginated-response';
import { ClinicAccessContext } from '../patients/services/patient-access.service';
import { AppointmentsService } from './appointments.service';
import { CreateAppointmentDto } from './dto/create-appointment.dto';
import { CreateAppointmentTypeDto } from './dto/create-appointment-type.dto';
import { QueryAgendaAppointmentsDto } from './dto/query-agenda-appointments.dto';
import { QueryAppointmentTypesDto } from './dto/query-appointment-types.dto';
import { UpdateAppointmentDto } from './dto/update-appointment.dto';
import { UpdateAppointmentTypeDto } from './dto/update-appointment-type.dto';

@ApiTags('Appointments')
@ApiBearerAuth()
@ApiSecurity('x-clinic-id')
@Controller('appointments')
@AuthClinic()
@ClinicRoles(
  ClinicMembershipRole.owner,
  ClinicMembershipRole.admin,
  ClinicMembershipRole.odontologist,
  ClinicMembershipRole.specialist,
  ClinicMembershipRole.receptionist,
  ClinicMembershipRole.assistant,
)
export class AppointmentsController {
  constructor(private readonly appointmentService: AppointmentsService) {}

  @Post('types')
  @ApiOperation({ summary: 'Crear tipo de cita' })
  @ApiResponse({
    status: HttpStatus.CREATED,
    description: 'Tipo de cita creado',
  })
  createType(
    @GetClinicId() clinicId: string,
    @Body() createAppointmentTypeDto: CreateAppointmentTypeDto,
  ) {
    return this.appointmentService.createType(
      clinicId,
      createAppointmentTypeDto,
    );
  }

  @Get('types/all')
  @ApiOperation({ summary: 'Listar tipos de cita' })
  @ApiResponse({ status: HttpStatus.OK, description: 'Lista de tipos de cita' })
  findTypes(
    @GetClinicId() clinicId: string,
    @Query() query: QueryAppointmentTypesDto,
  ) {
    return this.appointmentService.findTypes(
      clinicId,
      query.search,
      query.includeInactive === 'true',
    );
  }

  @Get('types/recent-colors')
  @ApiOperation({
    summary: 'Colores usados recientemente en tipos de cita de la clínica',
  })
  recentColors(@GetClinicId() clinicId: string) {
    return this.appointmentService.recentColors(clinicId);
  }

  @Get('types/:id')
  @ApiOperation({ summary: 'Obtener tipo de cita' })
  findType(@GetClinicId() clinicId: string, @Param('id') id: string) {
    return this.appointmentService.findType(clinicId, id);
  }

  @Patch('types/:id')
  @ApiOperation({ summary: 'Actualizar tipo de cita' })
  @ApiParam({ name: 'id', description: 'UUID del tipo de cita' })
  @ApiResponse({
    status: HttpStatus.OK,
    description: 'Tipo de cita actualizado',
  })
  updateType(
    @GetClinicId() clinicId: string,
    @Param('id') id: string,
    @Body() updateAppointmentTypeDto: UpdateAppointmentTypeDto,
  ) {
    return this.appointmentService.updateType(
      clinicId,
      id,
      updateAppointmentTypeDto,
    );
  }

  @Delete('types/:id')
  @ApiOperation({ summary: 'Eliminar tipo de cita' })
  @ApiParam({ name: 'id', description: 'UUID del tipo de cita' })
  @ApiResponse({ status: HttpStatus.OK, description: 'Tipo de cita eliminado' })
  removeType(@GetClinicId() clinicId: string, @Param('id') id: string) {
    return this.appointmentService.removeType(clinicId, id);
  }

  @Post()
  @ApiOperation({ summary: 'Crear cita' })
  @ApiResponse({ status: HttpStatus.CREATED, description: 'Cita creada' })
  @ApiResponse({
    status: HttpStatus.BAD_REQUEST,
    description: 'Solapamiento de horario o datos inválidos',
  })
  create(
    @GetClinicId() clinicId: string,
    @GetClinicMembershipId() membershipId: string,
    @GetClinicMembershipRole() role: ClinicMembershipRole,
    @GetClinicPermissions() permissionsJson: Record<string, boolean>,
    @Body() createAppointmentDto: CreateAppointmentDto,
  ) {
    return this.appointmentService.create(
      this.context(clinicId, membershipId, role, permissionsJson),
      createAppointmentDto,
    );
  }

  @Get()
  @ApiOperation({ summary: 'Listar citas de la clínica' })
  @ApiPaginatedResponse()
  findAll(
    @GetClinicId() clinicId: string,
    @GetClinicMembershipId() membershipId: string,
    @GetClinicMembershipRole() role: ClinicMembershipRole,
    @GetClinicPermissions() permissionsJson: Record<string, boolean>,
    @Query() pagination: ListQueryDto,
  ) {
    return this.appointmentService.findAll(
      this.context(clinicId, membershipId, role, permissionsJson),
      pagination,
    );
  }

  @Get('agenda')
  @ApiOperation({
    summary: 'Listar agenda de un profesional con disponibilidad',
  })
  @ApiResponse({
    status: HttpStatus.OK,
    description: 'Citas y disponibilidad del profesional para el rango',
  })
  findAgenda(
    @GetClinicId() clinicId: string,
    @GetClinicMembershipId() membershipId: string,
    @GetClinicMembershipRole() role: ClinicMembershipRole,
    @GetClinicPermissions() permissionsJson: Record<string, boolean>,
    @Query() query: QueryAgendaAppointmentsDto,
  ) {
    return this.appointmentService.findAgenda(
      this.context(clinicId, membershipId, role, permissionsJson),
      query,
    );
  }

  @Get(':id')
  @ApiOperation({ summary: 'Obtener cita por ID' })
  @ApiParam({ name: 'id', description: 'UUID de la cita' })
  @ApiResponse({ status: HttpStatus.OK, description: 'Cita encontrada' })
  @ApiResponse({
    status: HttpStatus.NOT_FOUND,
    description: 'Cita no encontrada',
  })
  findOne(
    @GetClinicId() clinicId: string,
    @GetClinicMembershipId() membershipId: string,
    @GetClinicMembershipRole() role: ClinicMembershipRole,
    @GetClinicPermissions() permissionsJson: Record<string, boolean>,
    @Param('id') id: string,
  ) {
    return this.appointmentService.findOne(
      this.context(clinicId, membershipId, role, permissionsJson),
      id,
    );
  }

  @Patch(':id')
  @ApiOperation({ summary: 'Actualizar cita' })
  @ApiParam({ name: 'id', description: 'UUID de la cita' })
  @ApiResponse({ status: HttpStatus.OK, description: 'Cita actualizada' })
  update(
    @GetClinicId() clinicId: string,
    @GetClinicMembershipId() membershipId: string,
    @GetClinicMembershipRole() role: ClinicMembershipRole,
    @GetClinicPermissions() permissionsJson: Record<string, boolean>,
    @Param('id') id: string,
    @Body() updateAppointmentDto: UpdateAppointmentDto,
  ) {
    return this.appointmentService.update(
      this.context(clinicId, membershipId, role, permissionsJson),
      id,
      updateAppointmentDto,
    );
  }

  @Delete(':id')
  @ApiOperation({ summary: 'Eliminar cita' })
  @ApiParam({ name: 'id', description: 'UUID de la cita' })
  @ApiResponse({ status: HttpStatus.OK, description: 'Cita eliminada' })
  remove(
    @GetClinicId() clinicId: string,
    @GetClinicMembershipId() membershipId: string,
    @GetClinicMembershipRole() role: ClinicMembershipRole,
    @GetClinicPermissions() permissionsJson: Record<string, boolean>,
    @Param('id') id: string,
  ) {
    return this.appointmentService.remove(
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
