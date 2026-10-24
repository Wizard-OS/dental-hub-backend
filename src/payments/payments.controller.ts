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

import {
  AuthClinic,
  ClinicPermissions,
  ClinicRoles,
  GetClinicId,
} from '../auth/decorators';
import { ClinicPermission } from '../auth/interfaces';
import { ClinicMembershipRole } from '../clinic-memberships/interfaces/clinic-membership-role.enum';
import { CreatePaymentDto } from './dto/create-payment.dto';
import { UpdatePaymentDto } from './dto/update-payment.dto';
import { VoidPaymentDto } from './dto/void-payment.dto';
import { PaymentsService } from './payments.service';

@ApiTags('Payments')
@ApiBearerAuth()
@ApiSecurity('x-clinic-id')
@Controller('payments')
@AuthClinic()
@ClinicRoles(
  ClinicMembershipRole.owner,
  ClinicMembershipRole.admin,
  ClinicMembershipRole.receptionist,
)
@ClinicPermissions(ClinicPermission.manageFinancial)
export class PaymentsController {
  constructor(private readonly paymentsService: PaymentsService) {}

  @Post()
  @ApiOperation({ summary: 'Registrar pago' })
  @ApiResponse({ status: 201, description: 'Pago registrado' })
  create(
    @GetClinicId() clinicId: string,
    @Body() createPaymentDto: CreatePaymentDto,
  ) {
    return this.paymentsService.create(clinicId, createPaymentDto);
  }

  @Get()
  @ApiOperation({ summary: 'Listar pagos de la clínica' })
  @ApiResponse({ status: 200, description: 'Lista de pagos' })
  findAll(@GetClinicId() clinicId: string) {
    return this.paymentsService.findAll(clinicId);
  }

  @Get(':id')
  @ApiOperation({ summary: 'Obtener pago por ID' })
  @ApiParam({ name: 'id', description: 'UUID del pago' })
  @ApiResponse({ status: 200, description: 'Pago encontrado' })
  findOne(@GetClinicId() clinicId: string, @Param('id') id: string) {
    return this.paymentsService.findOne(clinicId, id);
  }

  @Patch(':id')
  @ApiOperation({ summary: 'Actualizar pago' })
  @ApiParam({ name: 'id', description: 'UUID del pago' })
  @ApiResponse({ status: 200, description: 'Pago actualizado' })
  update(
    @GetClinicId() clinicId: string,
    @Param('id') id: string,
    @Body() updatePaymentDto: UpdatePaymentDto,
  ) {
    return this.paymentsService.update(clinicId, id, updatePaymentDto);
  }

  @Delete(':id')
  @ApiOperation({ summary: 'Eliminar pago' })
  @ApiParam({ name: 'id', description: 'UUID del pago' })
  @ApiResponse({ status: 200, description: 'Pago eliminado' })
  remove(@GetClinicId() clinicId: string, @Param('id') id: string) {
    return this.paymentsService.remove(clinicId, id);
  }

  @Patch(':id/void')
  @ApiOperation({ summary: 'Anular pago' })
  @ApiParam({ name: 'id', description: 'UUID del pago' })
  @ApiResponse({ status: 200, description: 'Pago anulado' })
  void(
    @GetClinicId() clinicId: string,
    @Param('id') id: string,
    @Body() voidPaymentDto: VoidPaymentDto,
  ) {
    return this.paymentsService.void(clinicId, id, voidPaymentDto);
  }
}
