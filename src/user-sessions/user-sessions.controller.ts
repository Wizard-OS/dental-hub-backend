import { Controller, Delete, Get, Param } from '@nestjs/common';
import {
  ApiTags,
  ApiOperation,
  ApiResponse,
  ApiBearerAuth,
  ApiParam,
} from '@nestjs/swagger';

import { Auth, GetUser } from '../auth/decorators';
import { User } from '../auth/entities/user.entity';
import { UserSessionsService } from './user-sessions.service';

@ApiTags('User Sessions')
@ApiBearerAuth()
@Controller('user-sessions')
@Auth()
export class UserSessionsController {
  constructor(private readonly userSessionsService: UserSessionsService) {}

  @Get()
  @ApiOperation({ summary: 'Obtener sesiones activas del usuario' })
  @ApiResponse({ status: 200, description: 'Lista de sesiones activas' })
  getActiveSessions(@GetUser() user: User) {
    return this.userSessionsService.getActiveSessions(
      user.id,
      user.currentSessionId,
    );
  }

  @Delete(':id')
  @ApiOperation({ summary: 'Revocar una sesión específica' })
  @ApiParam({ name: 'id', description: 'UUID de la sesión' })
  @ApiResponse({ status: 200, description: 'Sesión revocada' })
  revokeSession(@GetUser() user: User, @Param('id') sessionId: string) {
    return this.userSessionsService.revokeSession(user.id, sessionId);
  }

  @Delete()
  @ApiOperation({ summary: 'Revocar todas las demás sesiones' })
  @ApiResponse({ status: 200, description: 'Sesiones revocadas' })
  revokeAllOtherSessions(@GetUser() user: User) {
    return this.userSessionsService.revokeAllOtherSessions(
      user.id,
      user.currentSessionId,
    );
  }
}
