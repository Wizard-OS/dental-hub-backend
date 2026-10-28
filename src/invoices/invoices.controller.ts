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
import { CreateInvoiceDto } from './dto/create-invoice.dto';
import { CreateInvoiceItemDto } from './dto/create-invoice-item.dto';
import { UpdateInvoiceDto } from './dto/update-invoice.dto';
import { InvoicesService } from './invoices.service';

@ApiTags('Invoices')
@ApiBearerAuth()
@ApiSecurity('x-clinic-id')
@Controller('invoices')
@AuthClinic()
@ClinicRoles(
  ClinicMembershipRole.owner,
  ClinicMembershipRole.admin,
  ClinicMembershipRole.receptionist,
)
@ClinicPermissions(ClinicPermission.manageFinancial)
export class InvoicesController {
  constructor(private readonly invoiceService: InvoicesService) {}

  @Post()
  @ApiOperation({ summary: 'Crear factura' })
  @ApiResponse({ status: HttpStatus.CREATED, description: 'Factura creada' })
  create(
    @GetClinicId() clinicId: string,
    @Body() createInvoiceDto: CreateInvoiceDto,
  ) {
    return this.invoiceService.create(clinicId, createInvoiceDto);
  }

  @Get()
  @ApiOperation({ summary: 'Listar facturas de la clínica' })
  @ApiPaginatedResponse()
  findAll(@GetClinicId() clinicId: string, @Query() pagination: ListQueryDto) {
    return this.invoiceService.findAll(clinicId, pagination);
  }

  @Get(':id')
  @ApiOperation({ summary: 'Obtener factura por ID' })
  @ApiParam({ name: 'id', description: 'UUID de la factura' })
  @ApiResponse({ status: HttpStatus.OK, description: 'Factura encontrada' })
  @ApiResponse({
    status: HttpStatus.NOT_FOUND,
    description: 'Factura no encontrada',
  })
  findOne(@GetClinicId() clinicId: string, @Param('id') id: string) {
    return this.invoiceService.findOne(clinicId, id);
  }

  @Patch(':id')
  @ApiOperation({ summary: 'Actualizar factura' })
  @ApiParam({ name: 'id', description: 'UUID de la factura' })
  @ApiResponse({ status: HttpStatus.OK, description: 'Factura actualizada' })
  update(
    @GetClinicId() clinicId: string,
    @Param('id') id: string,
    @Body() updateInvoiceDto: UpdateInvoiceDto,
  ) {
    return this.invoiceService.update(clinicId, id, updateInvoiceDto);
  }

  @Delete(':id')
  @ApiOperation({ summary: 'Eliminar factura' })
  @ApiParam({ name: 'id', description: 'UUID de la factura' })
  @ApiResponse({ status: HttpStatus.OK, description: 'Factura eliminada' })
  remove(@GetClinicId() clinicId: string, @Param('id') id: string) {
    return this.invoiceService.remove(clinicId, id);
  }

  @Post(':id/items')
  @ApiOperation({ summary: 'Agregar ítem a factura' })
  @ApiParam({ name: 'id', description: 'UUID de la factura' })
  @ApiResponse({ status: HttpStatus.CREATED, description: 'Ítem agregado' })
  addItem(
    @GetClinicId() clinicId: string,
    @Param('id') id: string,
    @Body() createInvoiceItemDto: CreateInvoiceItemDto,
  ) {
    return this.invoiceService.addItem(clinicId, id, createInvoiceItemDto);
  }

  @Delete(':invoiceId/items/:itemId')
  @ApiOperation({ summary: 'Eliminar ítem de factura' })
  @ApiParam({ name: 'invoiceId', description: 'UUID de la factura' })
  @ApiParam({ name: 'itemId', description: 'UUID del ítem' })
  @ApiResponse({ status: HttpStatus.OK, description: 'Ítem eliminado' })
  removeItem(
    @GetClinicId() clinicId: string,
    @Param('invoiceId') invoiceId: string,
    @Param('itemId') itemId: string,
  ) {
    return this.invoiceService.removeItem(clinicId, invoiceId, itemId);
  }
}
