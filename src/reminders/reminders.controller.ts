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

import { AuthClinic, GetClinicId } from '../auth/decorators';
import { CreateReminderDto } from './dto/create-reminder.dto';
import { UpdateReminderDto } from './dto/update-reminder.dto';
import { RemindersService } from './reminders.service';

@ApiTags('Reminders')
@ApiBearerAuth()
@ApiSecurity('x-clinic-id')
@Controller('reminders')
@AuthClinic()
export class RemindersController {
  constructor(private readonly remindersService: RemindersService) {}

  @Post()
  @ApiOperation({ summary: 'Crear recordatorio' })
  @ApiResponse({ status: 201, description: 'Recordatorio creado' })
  create(
    @GetClinicId() clinicId: string,
    @Body() createReminderDto: CreateReminderDto,
  ) {
    return this.remindersService.create(clinicId, createReminderDto);
  }

  @Get()
  @ApiOperation({ summary: 'Listar recordatorios' })
  @ApiResponse({ status: 200, description: 'Lista de recordatorios' })
  findAll(@GetClinicId() clinicId: string) {
    return this.remindersService.findAll(clinicId);
  }

  @Get(':id')
  @ApiOperation({ summary: 'Obtener recordatorio por ID' })
  @ApiParam({ name: 'id', description: 'UUID del recordatorio' })
  @ApiResponse({ status: 200, description: 'Recordatorio encontrado' })
  findOne(@GetClinicId() clinicId: string, @Param('id') id: string) {
    return this.remindersService.findOne(clinicId, id);
  }

  @Patch(':id')
  @ApiOperation({ summary: 'Actualizar recordatorio' })
  @ApiParam({ name: 'id', description: 'UUID del recordatorio' })
  @ApiResponse({ status: 200, description: 'Recordatorio actualizado' })
  update(
    @GetClinicId() clinicId: string,
    @Param('id') id: string,
    @Body() updateReminderDto: UpdateReminderDto,
  ) {
    return this.remindersService.update(clinicId, id, updateReminderDto);
  }

  @Delete(':id')
  @ApiOperation({ summary: 'Eliminar recordatorio' })
  @ApiParam({ name: 'id', description: 'UUID del recordatorio' })
  @ApiResponse({ status: 200, description: 'Recordatorio eliminado' })
  remove(@GetClinicId() clinicId: string, @Param('id') id: string) {
    return this.remindersService.remove(clinicId, id);
  }
}
