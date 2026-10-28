import {
  Body,
  Controller,
  Get,
  HttpStatus,
  Param,
  Patch,
  Query,
} from '@nestjs/common';
import {
  ApiBearerAuth,
  ApiOperation,
  ApiParam,
  ApiResponse,
  ApiTags,
} from '@nestjs/swagger';

import { Auth } from '../auth/decorators';
import { ValidRoles } from '../auth/interfaces';
import { BackofficeService } from './backoffice.service';
import { QueryBackofficeClinicsDto } from './dto/query-backoffice-clinics.dto';
import { QueryBackofficeSupportRequestsDto } from './dto/query-backoffice-support-requests.dto';
import { QueryBackofficeUsersDto } from './dto/query-backoffice-users.dto';
import { UpdateBackofficeClinicDto } from './dto/update-backoffice-clinic.dto';
import { UpdateBackofficeSubscriptionDto } from './dto/update-backoffice-subscription.dto';
import { UpdateBackofficeSupportRequestDto } from './dto/update-backoffice-support-request.dto';
import { UpdateBackofficeUserDto } from './dto/update-backoffice-user.dto';

@ApiTags('Backoffice')
@ApiBearerAuth()
@Controller('backoffice')
@Auth(ValidRoles.superUser)
export class BackofficeController {
  constructor(private readonly backofficeService: BackofficeService) {}

  @Get('overview')
  @ApiOperation({ summary: 'Obtener métricas globales del SaaS' })
  @ApiResponse({
    status: HttpStatus.OK,
    description: 'Resumen global de backoffice',
  })
  getOverview() {
    return this.backofficeService.getOverview();
  }

  @Get('clinics')
  @ApiOperation({ summary: 'Listar clínicas para backoffice' })
  @ApiResponse({
    status: HttpStatus.OK,
    description: 'Lista paginada de clínicas',
  })
  findClinics(@Query() queryDto: QueryBackofficeClinicsDto) {
    return this.backofficeService.findClinics(queryDto);
  }

  @Get('clinics/:id')
  @ApiOperation({ summary: 'Obtener detalle global de una clínica' })
  @ApiParam({ name: 'id', description: 'UUID de la clínica' })
  @ApiResponse({ status: HttpStatus.OK, description: 'Detalle de clínica' })
  findClinic(@Param('id') id: string): Promise<unknown> {
    return this.backofficeService.findClinic(id);
  }

  @Patch('clinics/:id')
  @ApiOperation({ summary: 'Actualizar clínica desde backoffice' })
  @ApiParam({ name: 'id', description: 'UUID de la clínica' })
  @ApiResponse({ status: HttpStatus.OK, description: 'Clínica actualizada' })
  updateClinic(
    @Param('id') id: string,
    @Body() dto: UpdateBackofficeClinicDto,
  ) {
    return this.backofficeService.updateClinic(id, dto);
  }

  @Patch('clinics/:id/subscription')
  @ApiOperation({ summary: 'Asignar plan comercial desde backoffice' })
  @ApiParam({ name: 'id', description: 'UUID de la clínica' })
  @ApiResponse({
    status: HttpStatus.OK,
    description: 'Suscripción actualizada',
  })
  updateClinicSubscription(
    @Param('id') id: string,
    @Body() dto: UpdateBackofficeSubscriptionDto,
  ): Promise<unknown> {
    return this.backofficeService.updateClinicSubscription(id, dto);
  }

  @Get('users')
  @ApiOperation({ summary: 'Listar usuarios para backoffice' })
  @ApiResponse({
    status: HttpStatus.OK,
    description: 'Lista paginada de usuarios',
  })
  findUsers(@Query() queryDto: QueryBackofficeUsersDto) {
    return this.backofficeService.findUsers(queryDto);
  }

  @Get('users/:id')
  @ApiOperation({ summary: 'Obtener detalle global de un usuario' })
  @ApiParam({ name: 'id', description: 'UUID del usuario' })
  @ApiResponse({ status: HttpStatus.OK, description: 'Detalle de usuario' })
  findUser(@Param('id') id: string) {
    return this.backofficeService.findUser(id);
  }

  @Patch('users/:id')
  @ApiOperation({ summary: 'Actualizar usuario desde backoffice' })
  @ApiParam({ name: 'id', description: 'UUID del usuario' })
  @ApiResponse({ status: HttpStatus.OK, description: 'Usuario actualizado' })
  updateUser(@Param('id') id: string, @Body() dto: UpdateBackofficeUserDto) {
    return this.backofficeService.updateUser(id, dto);
  }

  @Get('support-requests')
  @ApiOperation({ summary: 'Listar solicitudes de soporte para backoffice' })
  @ApiResponse({
    status: HttpStatus.OK,
    description: 'Lista paginada de solicitudes de soporte',
  })
  findSupportRequests(@Query() queryDto: QueryBackofficeSupportRequestsDto) {
    return this.backofficeService.findSupportRequests(queryDto);
  }

  @Patch('support-requests/:id')
  @ApiOperation({ summary: 'Actualizar estado de solicitud de soporte' })
  @ApiParam({ name: 'id', description: 'UUID de la solicitud' })
  @ApiResponse({ status: HttpStatus.OK, description: 'Solicitud actualizada' })
  updateSupportRequest(
    @Param('id') id: string,
    @Body() dto: UpdateBackofficeSupportRequestDto,
  ) {
    return this.backofficeService.updateSupportRequest(id, dto);
  }
}
