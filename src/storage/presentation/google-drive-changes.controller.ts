import {
  Controller,
  Headers,
  HttpCode,
  HttpStatus,
  Post,
  UnauthorizedException,
} from '@nestjs/common';
import { ApiExcludeEndpoint } from '@nestjs/swagger';

import { PersonalDrive } from '../application/personal-drive';

@Controller('webhooks/google-drive')
export class GoogleDriveChangesController {
  constructor(private readonly drive: PersonalDrive) {}

  @Post('changes')
  @HttpCode(HttpStatus.NO_CONTENT)
  @ApiExcludeEndpoint()
  async receive(
    @Headers('x-goog-channel-id') channelId?: string,
    @Headers('x-goog-channel-token') channelToken?: string,
  ): Promise<void> {
    if (!channelId || !channelToken) throw new UnauthorizedException();
    const accepted = await this.drive.handleDriveNotification(
      channelId,
      channelToken,
    );
    if (!accepted) throw new UnauthorizedException();
  }
}
