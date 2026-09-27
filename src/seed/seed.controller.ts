import { Controller, Get } from '@nestjs/common';
import { ApiTags, ApiOperation, ApiResponse } from '@nestjs/swagger';

import { Auth } from '../auth/decorators';
import { ValidRoles } from '../auth/interfaces';
import { SeedService } from './seed.service';

@ApiTags('Seed')
@Controller('seed')
@Auth(ValidRoles.admin, ValidRoles.superUser)
export class SeedController {
  constructor(private readonly seedService: SeedService) {}

  @Get()
  @ApiOperation({ summary: 'Ejecutar seed de datos de prueba' })
  @ApiResponse({ status: 200, description: 'Seed ejecutado correctamente' })
  executeSeed() {
    return this.seedService.runSeed();
  }
}
