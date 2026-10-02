import { Controller, Get } from '@nestjs/common';
import {
  ApiBearerAuth,
  ApiOperation,
  ApiResponse,
  ApiTags,
} from '@nestjs/swagger';
import { I18n, I18nContext } from 'nestjs-i18n';

import { Auth } from '../../auth/decorators';
import { GetPatientGenderOptions } from '../application/get-patient-gender-options.use-case';
import { PatientGenderOptionResponseDto } from './dto/patient-gender-option.response.dto';

@ApiTags('Common')
@ApiBearerAuth()
@Controller('common')
@Auth()
export class PatientGendersController {
  constructor(
    private readonly getPatientGenderOptions: GetPatientGenderOptions,
  ) {}

  @Get('patient-genders')
  @ApiOperation({ summary: 'Listar géneros disponibles para pacientes' })
  @ApiResponse({
    status: 200,
    description: 'Opciones de género en el idioma solicitado',
    type: [PatientGenderOptionResponseDto],
  })
  findAll(@I18n() i18n: I18nContext): PatientGenderOptionResponseDto[] {
    return this.getPatientGenderOptions.execute(i18n.lang);
  }
}
