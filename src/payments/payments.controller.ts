import { HttpStatus, Query } from '@nestjs/common';
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
import { ListQueryDto } from '../common/dtos/list-query.dto';
import { ApiPaginatedResponse } from '../common/presentation/api-paginated-response';
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
  @ApiResponse({ status: HttpStatus.CREATED, description: 'Pago registrado' })
  create(
    @GetClinicId() clinicId: string,
    @Body() createPaymentDto: CreatePaymentDto,
  ) {
    return this.paymentsService.create(clinicId, createPaymentDto);
  }

  @Get()
  @ApiOperation({ summary: 'Listar pagos de la clínica' })
  @ApiPaginatedResponse()
  findAll(@GetClinicId() clinicId: string, @Query() pagination: ListQueryDto) {
    return this.paymentsService.findAll(clinicId, pagination);
  }

  @Get(':id')
  @ApiOperation({ summary: 'Obtener pago por ID' })
  @ApiParam({ name: 'id', description: 'UUID del pago' })
  @ApiResponse({ status: HttpStatus.OK, description: 'Pago encontrado' })
  findOne(@GetClinicId() clinicId: string, @Param('id') id: string) {
    return this.paymentsService.findOne(clinicId, id);
  }

  @Patch(':id')
  @ApiOperation({ summary: 'Actualizar pago' })
  @ApiParam({ name: 'id', description: 'UUID del pago' })
  @ApiResponse({ status: HttpStatus.OK, description: 'Pago actualizado' })
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
  @ApiResponse({ status: HttpStatus.OK, description: 'Pago eliminado' })
  remove(@GetClinicId() clinicId: string, @Param('id') id: string) {
    return this.paymentsService.remove(clinicId, id);
  }

  @Patch(':id/void')
  @ApiOperation({ summary: 'Anular pago' })
  @ApiParam({ name: 'id', description: 'UUID del pago' })
  @ApiResponse({ status: HttpStatus.OK, description: 'Pago anulado' })
  void(
    @GetClinicId() clinicId: string,
    @Param('id') id: string,
    @Body() voidPaymentDto: VoidPaymentDto,
  ) {
    return this.paymentsService.void(clinicId, id, voidPaymentDto);
  }
}
