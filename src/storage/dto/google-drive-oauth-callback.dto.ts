import { ApiProperty } from '@nestjs/swagger';
import { IsString, IsUrl, Length } from 'class-validator';
import { i18nValidationMessage } from 'nestjs-i18n';

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

  @ApiProperty({
    description: 'One-time OAuth state returned by Google',
    minLength: 43,
    maxLength: 43,
  })
  @IsString({ message: i18nValidationMessage('validation.isString') })
  @Length(43, 43, { message: i18nValidationMessage('validation.length') })
  state: string;
}
