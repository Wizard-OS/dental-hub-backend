import { i18nValidationMessage } from 'nestjs-i18n';
import { IsString, IsUrl } from 'class-validator';
import { ApiProperty } from '@nestjs/swagger';

export class GoogleDriveOAuthCallbackDto {
  @ApiProperty({ description: 'Authorization code returned by Google OAuth' })
  @IsString({ message: i18nValidationMessage('validation.isString') })
  code: string;

  @ApiProperty({
    description: 'Redirect URI used to generate the OAuth URL',
    example: 'https://app.dentalhub.example/integrations/google-drive/callback',
  })
  @IsUrl(
    { require_tld: false },
    { message: i18nValidationMessage('validation.isUrl') },
  )
  redirectUri: string;
}
