import { Controller, Get, Res, StreamableFile } from '@nestjs/common';
import {
  ApiBearerAuth,
  ApiOperation,
  ApiResponse,
  ApiSecurity,
  ApiTags,
} from '@nestjs/swagger';
import type { Response } from 'express';

import {
  AuthClinic,
  ClinicPermissions,
  ClinicRoles,
  GetClinicId,
} from '../auth/decorators';
import { ClinicPermission } from '../auth/interfaces';
import { ClinicMembershipRole } from '../clinic-memberships/interfaces/clinic-membership-role.enum';
import { BillingService } from './billing.service';

@ApiTags('Billing')
@ApiBearerAuth()
@ApiSecurity('x-clinic-id')
@Controller('billing-history')
@AuthClinic()
@ClinicRoles(
  ClinicMembershipRole.owner,
  ClinicMembershipRole.admin,
  ClinicMembershipRole.receptionist,
)
@ClinicPermissions(ClinicPermission.manageFinancial)
export class BillingHistoryController {
  constructor(private readonly billingService: BillingService) {}

  @Get()
  @ApiOperation({ summary: 'Listar historial de facturación de la clínica' })
  @ApiResponse({ status: 200, description: 'Historial de facturación' })
  findAll(@GetClinicId() clinicId: string) {
    return this.billingService.getBillingHistory(clinicId);
  }

  @Get('export')
  @ApiOperation({ summary: 'Exportar historial de facturación en PDF' })
  @ApiResponse({ status: 200, description: 'PDF del historial de facturación' })
  async export(
    @GetClinicId() clinicId: string,
    @Res({ passthrough: true }) response: Response,
  ) {
    const { filename, content } =
      await this.billingService.exportBillingHistoryPdf(clinicId);

    response.set({
      'Content-Type': 'application/pdf',
      'Content-Disposition': `attachment; filename="${filename}"`,
      'Content-Length': content.length.toString(),
    });

    return new StreamableFile(content);
  }
}
