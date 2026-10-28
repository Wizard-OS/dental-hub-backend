import { Controller, Get, HttpStatus } from '@nestjs/common';
import {
  ApiBearerAuth,
  ApiOperation,
  ApiResponse,
  ApiTags,
} from '@nestjs/swagger';

import { Auth } from '../auth/decorators';
import { CountriesService } from './countries.service';

@ApiTags('Common')
@ApiBearerAuth()
@Controller('common')
@Auth()
export class CountriesController {
  constructor(private readonly countriesService: CountriesService) {}

  @Get('countries')
  @ApiOperation({ summary: 'Listar países disponibles para configuración' })
  @ApiResponse({ status: HttpStatus.OK, description: 'Lista de países' })
  findAll() {
    return this.countriesService.findAll();
  }
}
