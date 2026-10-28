import {
  Body,
  Controller,
  Delete,
  Get,
  HttpStatus,
  Param,
  Patch,
  Post,
} from '@nestjs/common';
import {
  ApiBearerAuth,
  ApiOperation,
  ApiParam,
  ApiResponse,
  ApiTags,
} from '@nestjs/swagger';

import { Auth, GetUser } from '../auth/decorators';
import { User } from '../auth/entities/user.entity';
import { CreatePaymentMethodDto } from './dto/create-payment-method.dto';
import { UpdatePaymentMethodDto } from './dto/update-payment-method.dto';
import { PaymentMethodsService } from './payment-methods.service';

@ApiTags('Payment Methods')
@ApiBearerAuth()
@Controller('payment-methods')
@Auth()
export class PaymentMethodsController {
  constructor(private readonly paymentMethodsService: PaymentMethodsService) {}

  @Post()
  @ApiOperation({ summary: 'Crear método de pago' })
  @ApiResponse({
    status: HttpStatus.CREATED,
    description: 'Método de pago creado',
  })
  create(@GetUser() user: User, @Body() dto: CreatePaymentMethodDto) {
    return this.paymentMethodsService.create(user.id, dto);
  }

  @Get()
  @ApiOperation({ summary: 'Listar métodos de pago del usuario' })
  @ApiResponse({
    status: HttpStatus.OK,
    description: 'Lista de métodos de pago',
  })
  findAll(@GetUser() user: User) {
    return this.paymentMethodsService.findAll(user.id);
  }

  @Get(':id')
  @ApiOperation({ summary: 'Obtener método de pago por ID' })
  @ApiParam({ name: 'id', description: 'UUID del método de pago' })
  @ApiResponse({
    status: HttpStatus.OK,
    description: 'Método de pago encontrado',
  })
  findOne(@GetUser() user: User, @Param('id') id: string) {
    return this.paymentMethodsService.findOne(user.id, id);
  }

  @Patch(':id')
  @ApiOperation({ summary: 'Actualizar método de pago' })
  @ApiParam({ name: 'id', description: 'UUID del método de pago' })
  @ApiResponse({
    status: HttpStatus.OK,
    description: 'Método de pago actualizado',
  })
  update(
    @GetUser() user: User,
    @Param('id') id: string,
    @Body() dto: UpdatePaymentMethodDto,
  ) {
    return this.paymentMethodsService.update(user.id, id, dto);
  }

  @Delete(':id')
  @ApiOperation({ summary: 'Eliminar método de pago' })
  @ApiParam({ name: 'id', description: 'UUID del método de pago' })
  @ApiResponse({
    status: HttpStatus.OK,
    description: 'Método de pago eliminado',
  })
  remove(@GetUser() user: User, @Param('id') id: string) {
    return this.paymentMethodsService.remove(user.id, id);
  }

  @Patch(':id/set-default')
  @ApiOperation({ summary: 'Establecer método de pago como predeterminado' })
  @ApiParam({ name: 'id', description: 'UUID del método de pago' })
  @ApiResponse({
    status: HttpStatus.OK,
    description: 'Método de pago establecido como predeterminado',
  })
  setDefault(@GetUser() user: User, @Param('id') id: string) {
    return this.paymentMethodsService.setDefault(user.id, id);
  }
}
