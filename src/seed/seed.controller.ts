import { Controller, Get } from '@nestjs/common';
import { ApiTags, ApiOperation, ApiResponse } from '@nestjs/swagger';

import { SeedService } from './seed.service';

@ApiTags('Seed')
@Controller('seed')
export class SeedController {
  constructor(private readonly seedService: SeedService) {}

  @Get()
  @ApiOperation({ summary: 'Ejecutar seed de datos de prueba' })
  @ApiResponse({ status: 200, description: 'Seed ejecutado correctamente' })
  // @Auth( ValidRoles.admin )
  executeSeed() {
    return this.seedService.runSeed();
  }
}
