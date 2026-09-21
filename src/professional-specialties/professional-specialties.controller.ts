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
import { ApiBearerAuth, ApiOperation, ApiTags } from '@nestjs/swagger';

import {
  Auth,
  AuthClinic,
  ClinicPermissions,
  ClinicRoles,
} from '../auth/decorators';
import { ClinicPermission } from '../auth/interfaces';
import { ClinicMembershipRole } from '../clinic-memberships/interfaces/clinic-membership-role.enum';
import { CreateProfessionalSpecialtyDto } from './dto/create-professional-specialty.dto';
import { UpdateProfessionalSpecialtyDto } from './dto/update-professional-specialty.dto';
import { ProfessionalSpecialtiesService } from './professional-specialties.service';

@ApiTags('Professional Specialties')
@Controller('professional-specialties')
export class ProfessionalSpecialtiesController {
  constructor(
    private readonly professionalSpecialtiesService: ProfessionalSpecialtiesService,
  ) {}

  @Get()
  @Auth()
  @ApiBearerAuth()
  @ApiOperation({ summary: 'List active professional specialties' })
  findAll(@Query('includeInactive') includeInactive?: string) {
    return this.professionalSpecialtiesService.findAll(
      includeInactive === 'true',
    );
  }

  @Post()
  @AuthClinic()
  @ClinicRoles(ClinicMembershipRole.owner, ClinicMembershipRole.admin)
  @ClinicPermissions(ClinicPermission.manageClinic)
  @ApiBearerAuth()
  create(@Body() dto: CreateProfessionalSpecialtyDto) {
    return this.professionalSpecialtiesService.create(dto);
  }

  @Patch(':id')
  @AuthClinic()
  @ClinicRoles(ClinicMembershipRole.owner, ClinicMembershipRole.admin)
  @ClinicPermissions(ClinicPermission.manageClinic)
  @ApiBearerAuth()
  update(@Param('id') id: string, @Body() dto: UpdateProfessionalSpecialtyDto) {
    return this.professionalSpecialtiesService.update(id, dto);
  }

  @Delete(':id')
  @AuthClinic()
  @ClinicRoles(ClinicMembershipRole.owner, ClinicMembershipRole.admin)
  @ClinicPermissions(ClinicPermission.manageClinic)
  @ApiBearerAuth()
  remove(@Param('id') id: string) {
    return this.professionalSpecialtiesService.remove(id);
  }
}
