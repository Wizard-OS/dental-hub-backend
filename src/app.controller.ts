import { Controller, Get, HttpStatus } from '@nestjs/common';
import { ApiOperation, ApiResponse, ApiTags } from '@nestjs/swagger';

import { AppService } from './app.service';
import { Public } from './auth/decorators/public.decorator';
import { ApiMessage } from './common/i18n/api-message';

@ApiTags('App')
@Controller()
export class AppController {
  constructor(private readonly appService: AppService) {}

  @Public()
  @Get()
  @ApiOperation({ summary: 'Health check' })
  @ApiResponse({
    status: HttpStatus.OK,
    description: 'API funcionando correctamente',
  })
  getHello(): ApiMessage {
    return this.appService.getHello();
  }
}
