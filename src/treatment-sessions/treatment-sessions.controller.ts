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

import { AuthClinic, GetClinicId } from '../auth/decorators';
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
    @Body() createTreatmentSessionDto: CreateTreatmentSessionDto,
  ) {
    return this.treatmentSessionsService.create(
      clinicId,
      createTreatmentSessionDto,
    );
  }

  @Get()
  @ApiOperation({ summary: 'Listar sesiones de tratamiento' })
  @ApiResponse({ status: 200, description: 'Lista de sesiones' })
  findAll(@GetClinicId() clinicId: string) {
    return this.treatmentSessionsService.findAll(clinicId);
  }

  @Get(':id')
  @ApiOperation({ summary: 'Obtener sesión por ID' })
  @ApiParam({ name: 'id', description: 'UUID de la sesión' })
  @ApiResponse({ status: 200, description: 'Sesión encontrada' })
  findOne(@GetClinicId() clinicId: string, @Param('id') id: string) {
    return this.treatmentSessionsService.findOne(clinicId, id);
  }

  @Patch(':id')
  @ApiOperation({ summary: 'Actualizar sesión de tratamiento' })
  @ApiParam({ name: 'id', description: 'UUID de la sesión' })
  @ApiResponse({ status: 200, description: 'Sesión actualizada' })
  update(
    @GetClinicId() clinicId: string,
    @Param('id') id: string,
    @Body() updateTreatmentSessionDto: UpdateTreatmentSessionDto,
  ) {
    return this.treatmentSessionsService.update(
      clinicId,
      id,
      updateTreatmentSessionDto,
    );
  }

  @Delete(':id')
  @ApiOperation({ summary: 'Eliminar sesión de tratamiento' })
  @ApiParam({ name: 'id', description: 'UUID de la sesión' })
  @ApiResponse({ status: 200, description: 'Sesión eliminada' })
  remove(@GetClinicId() clinicId: string, @Param('id') id: string) {
    return this.treatmentSessionsService.remove(clinicId, id);
  }
}
