import { Body, Controller, Get, Post, Query } from '@nestjs/common';
import {
  ApiBearerAuth,
  ApiCreatedResponse,
  ApiOkResponse,
  ApiOperation,
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
import {
  MembershipQuotePreviewResponseDto,
  MembershipPaymentMethodsResponseDto,
} from './dto/membership-quote-response.dto';
import { BillingService } from './billing.service';
import {
  ConfirmMembershipDto,
  MembershipQuoteDto,
} from './dto/membership-quote.dto';

@ApiTags('Membership')
@ApiBearerAuth()
@ApiSecurity('x-clinic-id')
@AuthClinic()
@ClinicRoles(ClinicMembershipRole.owner, ClinicMembershipRole.admin)
@ClinicPermissions(ClinicPermission.manageClinic)
@Controller('membership')
export class MembershipCheckoutController {
  constructor(private readonly billing: BillingService) {}

  @Get('plans')
  @ApiOperation({
    summary: 'Catálogo Premium, precios en centavos y capacidades de pago',
  })
  plans() {
    return this.billing.getPlans();
  }

  @Post('quote')
  @ApiCreatedResponse({ type: MembershipQuotePreviewResponseDto })
  @ApiOperation({
    summary:
      'Previsualizar plan, promoción y primer cobro; no inicia la prueba',
  })
  quote(@GetClinicId() clinicId: string, @Body() dto: MembershipQuoteDto) {
    return this.billing.quote(clinicId, dto);
  }

  @Get('promotions')
  @ApiOperation({
    summary: 'Promociones disponibles para el intervalo seleccionado',
  })
  promotions(
    @GetClinicId() clinicId: string,
    @Query() dto: MembershipQuoteDto,
  ) {
    return this.billing.promotions(clinicId, dto.interval);
  }

  @Get('payment-methods')
  @ApiOkResponse({ type: MembershipPaymentMethodsResponseDto })
  @ApiOperation({
    summary: 'Métodos guardados de la membresía y capacidades del proveedor',
  })
  paymentMethods(@GetClinicId() clinicId: string) {
    return this.billing.paymentMethods(clinicId);
  }

  @Post('confirm')
  @ApiOperation({
    summary: 'Confirmar aprobación consultando la suscripción en PayPal',
  })
  confirm(@GetClinicId() clinicId: string, @Body() dto: ConfirmMembershipDto) {
    return this.billing.confirm(clinicId, dto.providerSubscriptionId);
  }

  @Post('restore')
  @ApiOperation({
    summary:
      'Restaurar el estado de la suscripción PayPal vinculada a esta clínica',
  })
  restore(@GetClinicId() clinicId: string) {
    return this.billing.confirm(clinicId);
  }

  @Post('cancel')
  @ApiOperation({
    summary:
      'Cancelar suscripción en PayPal y finalizar acceso Premium inmediatamente',
  })
  cancel(@GetClinicId() clinicId: string) {
    return this.billing.cancel(clinicId);
  }
}
