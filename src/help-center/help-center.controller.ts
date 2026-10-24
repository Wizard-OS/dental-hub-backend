import { Body, Controller, Get, Post } from '@nestjs/common';
import {
  ApiBearerAuth,
  ApiOperation,
  ApiResponse,
  ApiTags,
} from '@nestjs/swagger';

import { Auth, GetUser } from '../auth/decorators';
import { User } from '../auth/entities/user.entity';
import { CreateSupportRequestDto } from './dto/create-support-request.dto';
import { HelpCenterService } from './help-center.service';

@ApiTags('Help Center')
@Controller('help-center')
export class HelpCenterController {
  constructor(private readonly helpCenterService: HelpCenterService) {}

  @Get('faqs')
  @ApiOperation({ summary: 'Obtener preguntas frecuentes' })
  @ApiResponse({ status: 200, description: 'Lista de FAQs' })
  getFaqs() {
    return this.helpCenterService.getFaqs();
  }

  @Get('contact')
  @ApiOperation({ summary: 'Obtener información de contacto' })
  @ApiResponse({ status: 200, description: 'Información de contacto' })
  getContactInfo() {
    return this.helpCenterService.getContactInfo();
  }

  @Post('support-request')
  @Auth()
  @ApiBearerAuth()
  @ApiOperation({ summary: 'Crear solicitud de soporte' })
  @ApiResponse({ status: 201, description: 'Solicitud creada' })
  createSupportRequest(
    @GetUser() user: User,
    @Body() dto: CreateSupportRequestDto,
  ) {
    return this.helpCenterService.createSupportRequest(user.id, dto);
  }

  @Get('support-requests')
  @Auth()
  @ApiBearerAuth()
  @ApiOperation({ summary: 'Listar solicitudes de soporte del usuario' })
  @ApiResponse({ status: 200, description: 'Lista de solicitudes' })
  getUserSupportRequests(@GetUser() user: User) {
    return this.helpCenterService.getUserSupportRequests(user.id);
  }
}
