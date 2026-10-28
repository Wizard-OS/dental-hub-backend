import { Body, Controller, Get, HttpStatus, Post } from '@nestjs/common';
import {
  ApiBearerAuth,
  ApiOperation,
  ApiResponse,
  ApiTags,
} from '@nestjs/swagger';

import { Auth, GetUser } from '../auth/decorators';
import { Public } from '../auth/decorators/public.decorator';
import { User } from '../auth/entities/user.entity';
import { CreateSupportRequestDto } from './dto/create-support-request.dto';
import { HelpCenterService } from './help-center.service';

@ApiTags('Help Center')
@Controller('help-center')
export class HelpCenterController {
  constructor(private readonly helpCenterService: HelpCenterService) {}

  @Public()
  @Get('faqs')
  @ApiOperation({ summary: 'Obtener preguntas frecuentes' })
  @ApiResponse({ status: HttpStatus.OK, description: 'Lista de FAQs' })
  getFaqs() {
    return this.helpCenterService.getFaqs();
  }

  @Public()
  @Get('contact')
  @ApiOperation({ summary: 'Obtener información de contacto' })
  @ApiResponse({
    status: HttpStatus.OK,
    description: 'Información de contacto',
  })
  getContactInfo() {
    return this.helpCenterService.getContactInfo();
  }

  @Post('support-request')
  @Auth()
  @ApiBearerAuth()
  @ApiOperation({ summary: 'Crear solicitud de soporte' })
  @ApiResponse({ status: HttpStatus.CREATED, description: 'Solicitud creada' })
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
  @ApiResponse({ status: HttpStatus.OK, description: 'Lista de solicitudes' })
  getUserSupportRequests(@GetUser() user: User) {
    return this.helpCenterService.getUserSupportRequests(user.id);
  }
}
