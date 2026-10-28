import { HttpStatus, Query } from '@nestjs/common';
import {
  Body,
  Controller,
  Delete,
  Get,
  Param,
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
import { ListQueryDto } from '../common/dtos/list-query.dto';
import { ApiPaginatedResponse } from '../common/presentation/api-paginated-response';
import { ClinicAccessContext } from '../patients/services/patient-access.service';
import { CreateTreatmentDto } from './dto/create-treatment.dto';
import { UpdateTreatmentDto } from './dto/update-treatment.dto';
import { TreatmentsService } from './treatments.service';

@ApiTags('Treatments')
@ApiBearerAuth()
@ApiSecurity('x-clinic-id')
@Controller('treatments')
@AuthClinic()
@ClinicRoles(
  ClinicMembershipRole.owner,
  ClinicMembershipRole.admin,
  ClinicMembershipRole.odontologist,
  ClinicMembershipRole.specialist,
)
export class TreatmentsController {
  constructor(private readonly treatmentsService: TreatmentsService) {}

  @Post()
  @ApiOperation({ summary: 'Crear tratamiento' })
  @ApiResponse({
    status: HttpStatus.CREATED,
    description: 'Tratamiento creado',
  })
  create(
    @GetClinicId() clinicId: string,
    @GetClinicMembershipId() membershipId: string,
    @GetClinicMembershipRole() role: ClinicMembershipRole,
    @GetClinicPermissions() permissionsJson: Record<string, boolean>,
    @Body() createTreatmentDto: CreateTreatmentDto,
  ) {
    return this.treatmentsService.create(
      this.context(clinicId, membershipId, role, permissionsJson),
      createTreatmentDto,
    );
  }

  @Get()
  @ApiOperation({ summary: 'Listar tratamientos' })
  @ApiPaginatedResponse()
  findAll(
    @GetClinicId() clinicId: string,
    @GetClinicMembershipId() membershipId: string,
    @GetClinicMembershipRole() role: ClinicMembershipRole,
    @GetClinicPermissions() permissionsJson: Record<string, boolean>,
    @Query() pagination: ListQueryDto,
  ) {
    return this.treatmentsService.findAll(
      this.context(clinicId, membershipId, role, permissionsJson),
      pagination,
    );
  }

  @Get(':id')
  @ApiOperation({ summary: 'Obtener tratamiento por ID' })
  @ApiParam({ name: 'id', description: 'UUID del tratamiento' })
  @ApiResponse({ status: HttpStatus.OK, description: 'Tratamiento encontrado' })
  findOne(
    @GetClinicId() clinicId: string,
    @GetClinicMembershipId() membershipId: string,
    @GetClinicMembershipRole() role: ClinicMembershipRole,
    @GetClinicPermissions() permissionsJson: Record<string, boolean>,
    @Param('id') id: string,
  ) {
    return this.treatmentsService.findOne(
      this.context(clinicId, membershipId, role, permissionsJson),
      id,
    );
  }

  @Patch(':id')
  @ApiOperation({ summary: 'Actualizar tratamiento' })
  @ApiParam({ name: 'id', description: 'UUID del tratamiento' })
  @ApiResponse({
    status: HttpStatus.OK,
    description: 'Tratamiento actualizado',
  })
  update(
    @GetClinicId() clinicId: string,
    @GetClinicMembershipId() membershipId: string,
    @GetClinicMembershipRole() role: ClinicMembershipRole,
    @GetClinicPermissions() permissionsJson: Record<string, boolean>,
    @Param('id') id: string,
    @Body() updateTreatmentDto: UpdateTreatmentDto,
  ) {
    return this.treatmentsService.update(
      this.context(clinicId, membershipId, role, permissionsJson),
      id,
      updateTreatmentDto,
    );
  }

  @Delete(':id')
  @ApiOperation({ summary: 'Eliminar tratamiento' })
  @ApiParam({ name: 'id', description: 'UUID del tratamiento' })
  @ApiResponse({ status: HttpStatus.OK, description: 'Tratamiento eliminado' })
  remove(
    @GetClinicId() clinicId: string,
    @GetClinicMembershipId() membershipId: string,
    @GetClinicMembershipRole() role: ClinicMembershipRole,
    @GetClinicPermissions() permissionsJson: Record<string, boolean>,
    @Param('id') id: string,
  ) {
    return this.treatmentsService.remove(
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
