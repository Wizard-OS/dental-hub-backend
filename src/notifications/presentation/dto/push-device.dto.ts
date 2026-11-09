import { IsIn, IsNotEmpty, IsString, MaxLength } from 'class-validator';

import type { PushPlatform } from '../../application/notifications.port';

export class PushDeviceDto {
  @IsString()
  @IsNotEmpty()
  @MaxLength(4096)
  token: string;

  @IsIn(['android', 'ios'])
  platform: PushPlatform;
}

export class UnregisterPushDeviceDto {
  @IsString()
  @IsNotEmpty()
  @MaxLength(4096)
  token: string;
}
