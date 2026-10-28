import { Body, Controller, Get, HttpStatus, Patch } from '@nestjs/common';
import {
  ApiBearerAuth,
  ApiOperation,
  ApiResponse,
  ApiSecurity,
  ApiTags,
} from '@nestjs/swagger';

import {
  AuthClinic,
  ClinicPermissions,
  ClinicRoles,
  GetClinicId,
  GetClinicMembershipId,
} from '../auth/decorators';
import { ClinicPermission } from '../auth/interfaces';
import { ClinicMembershipRole } from '../clinic-memberships/interfaces/clinic-membership-role.enum';
import { UpdateMembershipPlanDto } from './dto/update-membership-plan.dto';
import { MembershipService } from './membership.service';

@ApiTags('Membership')
@ApiBearerAuth()
@ApiSecurity('x-clinic-id')
@Controller('membership')
@AuthClinic()
export class MembershipController {
  constructor(private readonly membershipService: MembershipService) {}

  @Get('current')
  @ApiOperation({ summary: 'Consultar membresía comercial actual' })
  @ApiResponse({
    status: HttpStatus.OK,
    description: 'Membresía, límites y consumo',
  })
  current(@GetClinicId() clinicId: string): Promise<unknown> {
    return this.membershipService.getCurrent(clinicId);
  }

  @Patch('manual')
  @ClinicRoles(ClinicMembershipRole.owner, ClinicMembershipRole.admin)
  @ClinicPermissions(ClinicPermission.manageClinic)
  @ApiOperation({ summary: 'Asignar membresía manualmente' })
  @ApiResponse({ status: HttpStatus.OK, description: 'Membresía actualizada' })
  manual(
    @GetClinicId() clinicId: string,
    @GetClinicMembershipId() membershipId: string,
    @Body() dto: UpdateMembershipPlanDto,
  ): Promise<unknown> {
    return this.membershipService.assignManual(
      clinicId,
      membershipId,
      dto.planCode,
      dto.reason,
    );
  }
}
