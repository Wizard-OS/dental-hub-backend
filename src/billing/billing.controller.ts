import { Body, Controller, Headers, Post } from '@nestjs/common';
import {
  ApiBearerAuth,
  ApiOperation,
  ApiResponse,
  ApiSecurity,
  ApiTags,
} from '@nestjs/swagger';
import type { IncomingHttpHeaders } from 'http';

import {
  AuthClinic,
  ClinicPermissions,
  ClinicRoles,
  GetClinicId,
  GetClinicMembershipId,
} from '../auth/decorators';
import { ClinicPermission } from '../auth/interfaces';
import { ClinicMembershipRole } from '../clinic-memberships/interfaces/clinic-membership-role.enum';
import { BillingService } from './billing.service';
import { CreateBillingCheckoutDto } from './dto/create-billing-checkout.dto';

@ApiTags('Billing')
@Controller('billing')
export class BillingController {
  constructor(private readonly billingService: BillingService) {}

  @Post('checkout')
  @AuthClinic()
  @ClinicRoles(ClinicMembershipRole.owner, ClinicMembershipRole.admin)
  @ClinicPermissions(ClinicPermission.manageClinic)
  @ApiBearerAuth()
  @ApiSecurity('x-clinic-id')
  @ApiOperation({ summary: 'Crear checkout de suscripción Premium con PayPal' })
  @ApiResponse({ status: 201, description: 'URL de aprobación PayPal' })
  createCheckout(
    @GetClinicId() clinicId: string,
    @Body() dto: CreateBillingCheckoutDto,
    @GetClinicMembershipId() actorId: string,
  ) {
    return this.billingService.createCheckout(clinicId, dto, actorId);
  }

  @Post('webhooks/paypal')
  @ApiOperation({ summary: 'Recibir webhooks de PayPal Billing' })
  @ApiResponse({ status: 201, description: 'Webhook recibido' })
  handlePayPalWebhook(
    @Headers() headers: IncomingHttpHeaders,
    @Body() payload: unknown,
  ) {
    return this.billingService.handlePayPalWebhook(headers, payload);
  }
}
