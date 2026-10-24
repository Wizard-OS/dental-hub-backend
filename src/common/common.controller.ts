import { Controller, Get, Query } from '@nestjs/common';
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
} from '../auth/decorators';
import { ClinicPermission } from '../auth/interfaces';
import { ClinicMembershipRole } from '../clinic-memberships/interfaces/clinic-membership-role.enum';
import { CommonService } from './common.service';

@ApiTags('Common')
@ApiBearerAuth()
@ApiSecurity('x-clinic-id')
@Controller('common')
@AuthClinic()
@ClinicRoles(
  ClinicMembershipRole.owner,
  ClinicMembershipRole.admin,
  ClinicMembershipRole.receptionist,
)
@ClinicPermissions(ClinicPermission.viewReports)
export class CommonController {
  constructor(private readonly commonService: CommonService) {}

  @Get('dashboard')
  @ApiOperation({
    summary: 'Obtener dashboard operativo/financiero de la clínica',
  })
  @ApiResponse({ status: 200, description: 'Datos del dashboard' })
  getDashboard(@GetClinicId() clinicId: string) {
    return this.commonService.getDashboard(clinicId);
  }

  @Get('reports/appointments')
  @ApiOperation({ summary: 'Reporte de citas por rango y estado' })
  @ApiResponse({ status: 200, description: 'Reporte de citas' })
  getAppointmentsReport(
    @GetClinicId() clinicId: string,
    @Query('from') from?: string,
    @Query('to') to?: string,
    @Query('status') status?: string,
    @Query('professionalMembershipId') professionalMembershipId?: string,
  ) {
    return this.commonService.getAppointmentsReport(clinicId, {
      from,
      to,
      status,
      professionalMembershipId,
    });
  }

  @Get('reports/income')
  @ApiOperation({ summary: 'Reporte de ingresos por periodo' })
  @ApiResponse({ status: 200, description: 'Reporte de ingresos' })
  getIncomeReport(
    @GetClinicId() clinicId: string,
    @Query('from') from?: string,
    @Query('to') to?: string,
  ) {
    return this.commonService.getIncomeReport(clinicId, { from, to });
  }

  @Get('reports/pending-payments')
  @ApiOperation({ summary: 'Reporte de pagos pendientes' })
  @ApiResponse({ status: 200, description: 'Reporte de deuda' })
  getPendingPaymentsReport(@GetClinicId() clinicId: string) {
    return this.commonService.getPendingPaymentsReport(clinicId);
  }

  @Get('reports/active-treatments')
  @ApiOperation({ summary: 'Reporte de tratamientos activos' })
  @ApiResponse({ status: 200, description: 'Reporte de tratamientos activos' })
  getActiveTreatmentsReport(@GetClinicId() clinicId: string) {
    return this.commonService.getActiveTreatmentsReport(clinicId);
  }
}
