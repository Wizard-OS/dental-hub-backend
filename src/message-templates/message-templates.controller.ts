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
import { CreateMessageTemplateDto } from './dto/create-message-template.dto';
import { UpdateMessageTemplateDto } from './dto/update-message-template.dto';
import { MessageTemplatesService } from './message-templates.service';

@ApiTags('Message Templates')
@ApiBearerAuth()
@ApiSecurity('x-clinic-id')
@Controller('message-templates')
@AuthClinic()
export class MessageTemplatesController {
  constructor(
    private readonly messageTemplatesService: MessageTemplatesService,
  ) {}

  @Post()
  @ApiOperation({ summary: 'Crear plantilla de mensaje' })
  @ApiResponse({ status: 201, description: 'Plantilla creada' })
  create(
    @GetClinicId() clinicId: string,
    @Body() createMessageTemplateDto: CreateMessageTemplateDto,
  ) {
    return this.messageTemplatesService.create(
      clinicId,
      createMessageTemplateDto,
    );
  }

  @Get()
  @ApiOperation({ summary: 'Listar plantillas de mensaje' })
  @ApiResponse({ status: 200, description: 'Lista de plantillas' })
  findAll(@GetClinicId() clinicId: string) {
    return this.messageTemplatesService.findAll(clinicId);
  }

  @Get(':id')
  @ApiOperation({ summary: 'Obtener plantilla por ID' })
  @ApiParam({ name: 'id', description: 'UUID de la plantilla' })
  @ApiResponse({ status: 200, description: 'Plantilla encontrada' })
  findOne(@GetClinicId() clinicId: string, @Param('id') id: string) {
    return this.messageTemplatesService.findOne(clinicId, id);
  }

  @Patch(':id')
  @ApiOperation({ summary: 'Actualizar plantilla de mensaje' })
  @ApiParam({ name: 'id', description: 'UUID de la plantilla' })
  @ApiResponse({ status: 200, description: 'Plantilla actualizada' })
  update(
    @GetClinicId() clinicId: string,
    @Param('id') id: string,
    @Body() updateMessageTemplateDto: UpdateMessageTemplateDto,
  ) {
    return this.messageTemplatesService.update(
      clinicId,
      id,
      updateMessageTemplateDto,
    );
  }

  @Delete(':id')
  @ApiOperation({ summary: 'Eliminar plantilla de mensaje' })
  @ApiParam({ name: 'id', description: 'UUID de la plantilla' })
  @ApiResponse({ status: 200, description: 'Plantilla eliminada' })
  remove(@GetClinicId() clinicId: string, @Param('id') id: string) {
    return this.messageTemplatesService.remove(clinicId, id);
  }
}
