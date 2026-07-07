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
  ApiTags,
  ApiOperation,
  ApiResponse,
  ApiBearerAuth,
  ApiParam,
  ApiSecurity,
} from '@nestjs/swagger';

import { ClinicsService } from './clinics.service';
import { CreateClinicDto } from './dto/create-clinic.dto';
import { UpdateClinicDto } from './dto/update-clinic.dto';
import {
  Auth,
  AuthClinic,
  ClinicRoles,
  GetClinicId,
  GetUser,
} from '../auth/decorators';
import { ClinicMembershipRole } from '../clinic-memberships/interfaces/clinic-membership-role.enum';

@ApiTags('Clinics')
@ApiBearerAuth()
@Controller('clinics')
@Auth()
export class ClinicsController {
  constructor(private readonly clinicsService: ClinicsService) {}

  @Post()
  @ApiOperation({ summary: 'Crear clínica' })
  @ApiResponse({ status: 201, description: 'Clínica creada' })
  create(
    @GetUser('id') userId: string,
    @Body() createClinicDto: CreateClinicDto,
  ) {
    return this.clinicsService.create(userId, createClinicDto);
  }

  @Get()
  @ApiOperation({ summary: 'Listar clínicas del usuario autenticado' })
  @ApiResponse({ status: 200, description: 'Lista de clínicas' })
  findAll(@GetUser('id') userId: string) {
    return this.clinicsService.findAllForUser(userId);
  }

  @Get(':id')
  @ApiOperation({ summary: 'Obtener clínica por ID' })
  @ApiParam({ name: 'id', description: 'UUID de la clínica' })
  @ApiResponse({ status: 200, description: 'Clínica encontrada' })
  @ApiResponse({ status: 404, description: 'Clínica no encontrada' })
  findOne(@GetUser('id') userId: string, @Param('id') id: string) {
    return this.clinicsService.findOneForUser(userId, id);
  }

  @Patch(':id')
  @AuthClinic()
  @ClinicRoles(ClinicMembershipRole.owner, ClinicMembershipRole.admin)
  @ApiSecurity('x-clinic-id')
  @ApiOperation({ summary: 'Actualizar clínica' })
  @ApiParam({ name: 'id', description: 'UUID de la clínica' })
  @ApiResponse({ status: 200, description: 'Clínica actualizada' })
  update(
    @GetClinicId() clinicId: string,
    @Param('id') id: string,
    @Body() updateClinicDto: UpdateClinicDto,
  ) {
    return this.clinicsService.update(clinicId, id, updateClinicDto);
  }

  @Delete(':id')
  @AuthClinic()
  @ClinicRoles(ClinicMembershipRole.owner)
  @ApiSecurity('x-clinic-id')
  @ApiOperation({ summary: 'Eliminar clínica' })
  @ApiParam({ name: 'id', description: 'UUID de la clínica' })
  @ApiResponse({ status: 200, description: 'Clínica eliminada' })
  remove(@GetClinicId() clinicId: string, @Param('id') id: string) {
    return this.clinicsService.remove(clinicId, id);
  }
}
