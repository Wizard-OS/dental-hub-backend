import {
  Body,
  Controller,
  Delete,
  Get,
  HttpStatus,
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
  ClinicPermissions,
  ClinicRoles,
  GetClinicId,
} from '../auth/decorators';
import { ClinicPermission } from '../auth/interfaces';
import { ClinicMembershipsService } from './clinic-memberships.service';
import { CreateClinicMembershipDto } from './dto/create-clinic-membership.dto';
import { UpdateClinicMembershipDto } from './dto/update-clinic-membership.dto';
import { ClinicMembershipRole } from './interfaces/clinic-membership-role.enum';

@ApiTags('Clinic Memberships')
@ApiBearerAuth()
@ApiSecurity('x-clinic-id')
@Controller('clinic-memberships')
@AuthClinic()
@ClinicRoles(ClinicMembershipRole.owner, ClinicMembershipRole.admin)
@ClinicPermissions(ClinicPermission.manageTeam)
export class ClinicMembershipsController {
  constructor(
    private readonly clinicMembershipsService: ClinicMembershipsService,
  ) {}

  @Post()
  @ApiOperation({ summary: 'Crear membresía de clínica' })
  @ApiResponse({ status: HttpStatus.CREATED, description: 'Membresía creada' })
  create(
    @GetClinicId() clinicId: string,
    @Body() createClinicMembershipDto: CreateClinicMembershipDto,
  ) {
    return this.clinicMembershipsService.create(
      clinicId,
      createClinicMembershipDto,
    );
  }

  @Get()
  @ApiOperation({
    summary: 'Listar membresías de la clínica activa',
  })
  @ApiResponse({ status: HttpStatus.OK, description: 'Lista de membresías' })
  findAll(@GetClinicId() clinicId: string) {
    return this.clinicMembershipsService.findAll(clinicId);
  }

  @Get(':id')
  @ApiOperation({ summary: 'Obtener membresía por ID' })
  @ApiParam({ name: 'id', description: 'UUID de la membresía' })
  @ApiResponse({ status: HttpStatus.OK, description: 'Membresía encontrada' })
  @ApiResponse({
    status: HttpStatus.NOT_FOUND,
    description: 'Membresía no encontrada',
  })
  findOne(@GetClinicId() clinicId: string, @Param('id') id: string) {
    return this.clinicMembershipsService.findOne(clinicId, id);
  }

  @Patch(':id')
  @ApiOperation({ summary: 'Actualizar membresía' })
  @ApiParam({ name: 'id', description: 'UUID de la membresía' })
  @ApiResponse({ status: HttpStatus.OK, description: 'Membresía actualizada' })
  update(
    @GetClinicId() clinicId: string,
    @Param('id') id: string,
    @Body() updateClinicMembershipDto: UpdateClinicMembershipDto,
  ) {
    return this.clinicMembershipsService.update(
      clinicId,
      id,
      updateClinicMembershipDto,
    );
  }

  @Delete(':id')
  @ApiOperation({ summary: 'Eliminar membresía' })
  @ApiParam({ name: 'id', description: 'UUID de la membresía' })
  @ApiResponse({ status: HttpStatus.OK, description: 'Membresía eliminada' })
  remove(@GetClinicId() clinicId: string, @Param('id') id: string) {
    return this.clinicMembershipsService.remove(clinicId, id);
  }
}
