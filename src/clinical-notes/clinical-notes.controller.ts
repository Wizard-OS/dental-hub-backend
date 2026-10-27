import {
  Body,
  Controller,
  Delete,
  Get,
  Param,
  ParseUUIDPipe,
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
  GetUser,
} from '../auth/decorators';
import { ClinicMembershipRole } from '../clinic-memberships/interfaces/clinic-membership-role.enum';
import { ListQueryDto } from '../common/dtos/list-query.dto';
import { ApiPaginatedResponse } from '../common/presentation/api-paginated-response';
import { ClinicAccessContext } from '../patients/services/patient-access.service';
import { ClinicalNotesService } from './clinical-notes.service';
import { CreateClinicalNoteDto } from './dto/create-clinical-note.dto';
import { QueryClinicalNotesDto } from './dto/query-clinical-notes.dto';
import { UpdateClinicalNoteDto } from './dto/update-clinical-note.dto';

@ApiTags('Clinical Notes')
@ApiBearerAuth()
@ApiSecurity('x-clinic-id')
@Controller('clinical-notes')
@AuthClinic()
@ClinicRoles(
  ClinicMembershipRole.owner,
  ClinicMembershipRole.admin,
  ClinicMembershipRole.odontologist,
  ClinicMembershipRole.specialist,
)
export class ClinicalNotesController {
  constructor(private readonly clinicalNotesService: ClinicalNotesService) {}

  @Post()
  @ApiOperation({ summary: 'Crear nota clínica' })
  @ApiResponse({ status: 201, description: 'Nota clínica creada' })
  create(
    @GetClinicId() clinicId: string,
    @GetUser('id') authorId: string,
    @GetClinicMembershipId() authorMembershipId: string,
    @GetClinicMembershipRole() role: ClinicMembershipRole,
    @GetClinicPermissions() permissionsJson: Record<string, boolean>,
    @Body() createClinicalNoteDto: CreateClinicalNoteDto,
  ) {
    return this.clinicalNotesService.create(
      this.context(clinicId, authorMembershipId, role, permissionsJson),
      authorId,
      authorMembershipId,
      createClinicalNoteDto,
    );
  }

  @Get()
  @ApiOperation({ summary: 'Listar notas clínicas' })
  @ApiPaginatedResponse()
  findAll(
    @GetClinicId() clinicId: string,
    @GetClinicMembershipId() membershipId: string,
    @GetClinicMembershipRole() role: ClinicMembershipRole,
    @GetClinicPermissions() permissionsJson: Record<string, boolean>,
    @Query() pagination: ListQueryDto,
  ) {
    return this.clinicalNotesService.findAll(
      this.context(clinicId, membershipId, role, permissionsJson),
      pagination,
    );
  }

  @Get('patient/:patientId')
  @ApiOperation({ summary: 'Obtener nota clínica por ID' })
  @ApiParam({ name: 'patientId', description: 'UUID de la nota clínica' })
  @ApiResponse({ status: 200, description: 'Nota clínica encontrada' })
  findByPatient(
    @GetClinicId() clinicId: string,
    @GetClinicMembershipId() membershipId: string,
    @GetClinicMembershipRole() role: ClinicMembershipRole,
    @GetClinicPermissions() permissionsJson: Record<string, boolean>,
    @Param('patientId', ParseUUIDPipe) patientId: string,
    @Query() query: QueryClinicalNotesDto,
  ) {
    return this.clinicalNotesService.findByPatient(
      this.context(clinicId, membershipId, role, permissionsJson),
      patientId,
      query,
    );
  }

  @Get(':id')
  @ApiOperation({ summary: 'Obtener nota clínica por ID' })
  @ApiParam({ name: 'id', description: 'UUID de la nota clínica' })
  @ApiResponse({ status: 200, description: 'Nota clínica encontrada' })
  findOne(
    @GetClinicId() clinicId: string,
    @GetClinicMembershipId() membershipId: string,
    @GetClinicMembershipRole() role: ClinicMembershipRole,
    @GetClinicPermissions() permissionsJson: Record<string, boolean>,
    @Param('id') id: string,
  ) {
    return this.clinicalNotesService.findOne(
      this.context(clinicId, membershipId, role, permissionsJson),
      id,
    );
  }

  @Patch(':id')
  @ApiOperation({ summary: 'Actualizar nota clínica' })
  @ApiParam({ name: 'id', description: 'UUID de la nota clínica' })
  @ApiResponse({ status: 200, description: 'Nota clínica actualizada' })
  update(
    @GetClinicId() clinicId: string,
    @GetClinicMembershipId() membershipId: string,
    @GetClinicMembershipRole() role: ClinicMembershipRole,
    @GetClinicPermissions() permissionsJson: Record<string, boolean>,
    @Param('id') id: string,
    @Body() updateClinicalNoteDto: UpdateClinicalNoteDto,
  ) {
    return this.clinicalNotesService.update(
      this.context(clinicId, membershipId, role, permissionsJson),
      id,
      updateClinicalNoteDto,
    );
  }

  @Delete(':id')
  @ApiOperation({ summary: 'Eliminar nota clínica' })
  @ApiParam({ name: 'id', description: 'UUID de la nota clínica' })
  @ApiResponse({ status: 200, description: 'Nota clínica eliminada' })
  remove(
    @GetClinicId() clinicId: string,
    @GetClinicMembershipId() membershipId: string,
    @GetClinicMembershipRole() role: ClinicMembershipRole,
    @GetClinicPermissions() permissionsJson: Record<string, boolean>,
    @Param('id') id: string,
  ) {
    return this.clinicalNotesService.remove(
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
