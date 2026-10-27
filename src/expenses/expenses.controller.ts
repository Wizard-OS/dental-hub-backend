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
import {
  ApiBearerAuth,
  ApiOperation,
  ApiParam,
  ApiQuery,
  ApiResponse,
  ApiSecurity,
  ApiTags,
} from '@nestjs/swagger';

import { AuthClinic, GetClinicId } from '../auth/decorators';
import { ListQueryDto } from '../common/dtos/list-query.dto';
import { ApiPaginatedResponse } from '../common/presentation/api-paginated-response';
import { CreateExpenseDto } from './dto/create-expense.dto';
import { UpdateExpenseDto } from './dto/update-expense.dto';
import { ExpensesService } from './expenses.service';

@ApiTags('Expenses')
@ApiBearerAuth()
@ApiSecurity('x-clinic-id')
@Controller('expenses')
@AuthClinic()
export class ExpensesController {
  constructor(private readonly expensesService: ExpensesService) {}

  @Post()
  @ApiOperation({ summary: 'Registrar gasto' })
  @ApiResponse({ status: 201, description: 'Gasto registrado' })
  create(
    @GetClinicId() clinicId: string,
    @Body() createExpenseDto: CreateExpenseDto,
  ) {
    return this.expensesService.create(clinicId, createExpenseDto);
  }

  @Get()
  @ApiOperation({ summary: 'Listar gastos de la clínica' })
  @ApiPaginatedResponse()
  findAll(@GetClinicId() clinicId: string, @Query() pagination: ListQueryDto) {
    return this.expensesService.findAll(clinicId, pagination);
  }

  @Get('totals')
  @ApiOperation({
    summary: 'Obtener totales de gastos (con rango de fechas opcional)',
  })
  @ApiQuery({
    name: 'from',
    required: false,
    description: 'Fecha inicio (ISO 8601)',
  })
  @ApiQuery({
    name: 'to',
    required: false,
    description: 'Fecha fin (ISO 8601)',
  })
  @ApiResponse({ status: 200, description: 'Totales de gastos' })
  totals(
    @GetClinicId() clinicId: string,
    @Query('from') from?: string,
    @Query('to') to?: string,
  ) {
    return this.expensesService.getTotals(clinicId, from, to);
  }

  @Get(':id')
  @ApiOperation({ summary: 'Obtener gasto por ID' })
  @ApiParam({ name: 'id', description: 'UUID del gasto' })
  @ApiResponse({ status: 200, description: 'Gasto encontrado' })
  findOne(@GetClinicId() clinicId: string, @Param('id') id: string) {
    return this.expensesService.findOne(clinicId, id);
  }

  @Patch(':id')
  @ApiOperation({ summary: 'Actualizar gasto' })
  @ApiParam({ name: 'id', description: 'UUID del gasto' })
  @ApiResponse({ status: 200, description: 'Gasto actualizado' })
  update(
    @GetClinicId() clinicId: string,
    @Param('id') id: string,
    @Body() updateExpenseDto: UpdateExpenseDto,
  ) {
    return this.expensesService.update(clinicId, id, updateExpenseDto);
  }

  @Delete(':id')
  @ApiOperation({ summary: 'Eliminar gasto' })
  @ApiParam({ name: 'id', description: 'UUID del gasto' })
  @ApiResponse({ status: 200, description: 'Gasto eliminado' })
  remove(@GetClinicId() clinicId: string, @Param('id') id: string) {
    return this.expensesService.remove(clinicId, id);
  }
}
