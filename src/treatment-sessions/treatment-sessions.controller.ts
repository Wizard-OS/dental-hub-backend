import { Query } from '@nestjs/common';
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
  GetClinicMembershipId,
  GetClinicMembershipRole,
  GetClinicPermissions,
} from '../auth/decorators';
import { AuthClinic, GetClinicId } from '../auth/decorators';
import { ClinicMembershipRole } from '../clinic-memberships/interfaces/clinic-membership-role.enum';
import { ListQueryDto } from '../common/dtos/list-query.dto';
import { ApiPaginatedResponse } from '../common/presentation/api-paginated-response';
import { CreateTreatmentSessionDto } from './dto/create-treatment-session.dto';
import { UpdateTreatmentSessionDto } from './dto/update-treatment-session.dto';
import { TreatmentSessionsService } from './treatment-sessions.service';

@ApiTags('Treatment Sessions')
@ApiBearerAuth()
@ApiSecurity('x-clinic-id')
@Controller('treatment-sessions')
@AuthClinic()
export class TreatmentSessionsController {
  constructor(
    private readonly treatmentSessionsService: TreatmentSessionsService,
  ) {}

  @Post()
  @ApiOperation({ summary: 'Crear sesión de tratamiento' })
  @ApiResponse({ status: 201, description: 'Sesión creada' })
  create(
    @GetClinicId() clinicId: string,
    @GetClinicMembershipId() membershipId: string,
    @GetClinicMembershipRole() role: ClinicMembershipRole,
    @GetClinicPermissions() permissionsJson: Record<string, boolean>,
    @Body() createTreatmentSessionDto: CreateTreatmentSessionDto,
  ) {
    return this.treatmentSessionsService.create(
      { clinicId, membershipId, role, permissionsJson },
      createTreatmentSessionDto,
    );
  }

  @Get()
  @ApiOperation({ summary: 'Listar sesiones de tratamiento' })
  @ApiPaginatedResponse()
  findAll(
    @GetClinicId() clinicId: string,
    @GetClinicMembershipId() membershipId: string,
    @GetClinicMembershipRole() role: ClinicMembershipRole,
    @GetClinicPermissions() permissionsJson: Record<string, boolean>,
    @Query() pagination: ListQueryDto,
  ) {
    return this.treatmentSessionsService.findAll(
      { clinicId, membershipId, role, permissionsJson },
      pagination,
    );
  }

  @Get(':id')
  @ApiOperation({ summary: 'Obtener sesión por ID' })
  @ApiParam({ name: 'id', description: 'UUID de la sesión' })
  @ApiResponse({ status: 200, description: 'Sesión encontrada' })
  findOne(
    @GetClinicId() clinicId: string,
    @GetClinicMembershipId() membershipId: string,
    @GetClinicMembershipRole() role: ClinicMembershipRole,
    @GetClinicPermissions() permissionsJson: Record<string, boolean>,
    @Param('id') id: string,
  ) {
    return this.treatmentSessionsService.findOne(
      { clinicId, membershipId, role, permissionsJson },
      id,
    );
  }

  @Patch(':id')
  @ApiOperation({ summary: 'Actualizar sesión de tratamiento' })
  @ApiParam({ name: 'id', description: 'UUID de la sesión' })
  @ApiResponse({ status: 200, description: 'Sesión actualizada' })
  update(
    @GetClinicId() clinicId: string,
    @GetClinicMembershipId() membershipId: string,
    @GetClinicMembershipRole() role: ClinicMembershipRole,
    @GetClinicPermissions() permissionsJson: Record<string, boolean>,
    @Param('id') id: string,
    @Body() updateTreatmentSessionDto: UpdateTreatmentSessionDto,
  ) {
    return this.treatmentSessionsService.update(
      { clinicId, membershipId, role, permissionsJson },
      id,
      updateTreatmentSessionDto,
    );
  }

  @Delete(':id')
  @ApiOperation({ summary: 'Eliminar sesión de tratamiento' })
  @ApiParam({ name: 'id', description: 'UUID de la sesión' })
  @ApiResponse({ status: 200, description: 'Sesión eliminada' })
  remove(
    @GetClinicId() clinicId: string,
    @GetClinicMembershipId() membershipId: string,
    @GetClinicMembershipRole() role: ClinicMembershipRole,
    @GetClinicPermissions() permissionsJson: Record<string, boolean>,
    @Param('id') id: string,
  ) {
    return this.treatmentSessionsService.remove(
      { clinicId, membershipId, role, permissionsJson },
      id,
    );
  }
}
