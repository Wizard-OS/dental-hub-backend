import { ApiCreatedResponse, ApiOkResponse } from '@nestjs/swagger';
import {
  Body,
  Controller,
  Delete,
  Get,
  Param,
  ParseUUIDPipe,
  Patch,
  Post,
} from '@nestjs/common';
import {
  ApiBearerAuth,
  ApiOperation,
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
import {
  CreateMembershipPaymentMethodDto,
  SelectMembershipPaymentMethodDto,
  StartMembershipDto,
  ReconcileMembershipChargeDto,
} from './dto/membership-payment-method.dto';
import { MembershipPaymentMethodsService } from './vault/membership-payment-methods.service';
import { MembershipRenewalsService } from './vault/membership-renewals.service';
import {
  MembershipSetupResponseDto,
  SavedMembershipPaymentMethodDto,
  MembershipChargeResponseDto,
} from './dto/membership-quote-response.dto';
import { getEnv } from '../config/env';

@ApiTags('Membership')
@ApiBearerAuth()
@ApiSecurity('x-clinic-id')
@AuthClinic()
@ClinicRoles(ClinicMembershipRole.owner, ClinicMembershipRole.admin)
@ClinicPermissions(ClinicPermission.manageClinic)
@Controller('membership')
export class MembershipPaymentsController {
  constructor(
    private readonly methods: MembershipPaymentMethodsService,
    private readonly renewals: MembershipRenewalsService,
  ) {}

  @Post('payment-methods/setup')
  @ApiCreatedResponse({ type: MembershipSetupResponseDto })
  @ApiOperation({
    summary:
      'Iniciar tokenización de tarjeta o autorización PayPal, sin datos de tarjeta en el backend',
  })
  setup(
    @GetClinicId() clinicId: string,
    @Body() dto: CreateMembershipPaymentMethodDto,
  ) {
    return this.methods.createSetup(clinicId, dto);
  }

  @Post('payment-methods/setup/:id/confirm')
  @ApiCreatedResponse({ type: SavedMembershipPaymentMethodDto })
  @ApiOperation({
    summary:
      'Guardar un método tras verificar la aprobación y propiedad en PayPal',
  })
  complete(
    @GetClinicId() clinicId: string,
    @Param('id', ParseUUIDPipe) id: string,
  ) {
    return this.methods.completeSetup(clinicId, id);
  }

  @Patch('payment-methods/default')
  @ApiOkResponse({ type: SavedMembershipPaymentMethodDto })
  @ApiOperation({ summary: 'Seleccionar el método de próximos cobros' })
  select(
    @GetClinicId() clinicId: string,
    @Body() dto: SelectMembershipPaymentMethodDto,
  ) {
    return this.methods.select(clinicId, dto.paymentMethodId);
  }

  @Delete('payment-methods/:id')
  @ApiOperation({ summary: 'Eliminar un método guardado de PayPal' })
  remove(
    @GetClinicId() clinicId: string,
    @Param('id', ParseUUIDPipe) id: string,
  ) {
    return this.methods.remove(clinicId, id);
  }

  @Post('start')
  @ApiOperation({
    summary:
      'Confirmar membresía con un método guardado y consentimiento de renovación',
  })
  start(
    @GetClinicId() clinicId: string,
    @GetClinicMembershipId() actorId: string,
    @Body() dto: StartMembershipDto,
  ) {
    return this.renewals.start(clinicId, actorId, dto);
  }

  @Get('charges')
  @ApiOkResponse({ type: [MembershipChargeResponseDto] })
  @ApiOperation({ summary: 'Historial de cobros recurrentes de la membresía' })
  charges(@GetClinicId() clinicId: string) {
    return this.renewals.charges(clinicId);
  }

  @Post('charges/:id/reconcile')
  @ApiOperation({
    summary:
      'Verificar una orden PayPal de este cobro y recuperar un resultado incierto',
  })
  reconcile(
    @GetClinicId() clinicId: string,
    @Param('id', ParseUUIDPipe) id: string,
    @Body() dto: ReconcileMembershipChargeDto,
  ) {
    return this.renewals.processClinic(clinicId, {
      chargeId: id,
      orderId: dto.providerOrderId,
    });
  }

  @Post('charges/:id/retry')
  @ApiOperation({
    summary: 'Reintentar un cobro fallido sin duplicar su orden',
  })
  retry(
    @GetClinicId() clinicId: string,
    @Param('id', ParseUUIDPipe) id: string,
  ) {
    return this.renewals.retry(clinicId, id);
  }

  @Get('readiness')
  @ApiOperation({
    summary: 'Estado de configuración de pagos y avisos, sin exponer secretos',
  })
  readiness() {
    const required = [
      'PAYPAL_CLIENT_ID',
      'PAYPAL_CLIENT_SECRET',
      'PAYPAL_RETURN_URL',
      'PAYPAL_CANCEL_URL',
      'PAYPAL_WEBHOOK_ID',
      'RESEND_API_KEY',
      'MEMBERSHIP_EMAIL_FROM',
    ];
    return {
      configured: required.every((key) => Boolean(getEnv(key))),
      missing: required.filter((key) => !getEnv(key)),
      workerEnabled: getEnv('BILLING_WORKER_ENABLED') !== 'false',
      paypalClientId: getEnv('PAYPAL_CLIENT_ID') ?? null,
      paypalEnvironment: getEnv('PAYPAL_ENV') === 'live' ? 'live' : 'sandbox',
    };
  }
}
