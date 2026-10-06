import {
  Body,
  ConflictException,
  Controller,
  Post,
  Req,
  ServiceUnavailableException,
  UnauthorizedException,
} from '@nestjs/common';
import { IsNotEmpty, IsOptional, IsString, MaxLength } from 'class-validator';
import {
  ApiBearerAuth,
  ApiProperty,
  ApiPropertyOptional,
  ApiTags,
} from '@nestjs/swagger';
import { Throttle } from '@nestjs/throttler';
import type { Request } from 'express';
import { Auth, GetUser } from '../decorators';
import { User } from '../entities/user.entity';
import { AuthService } from '../auth.service';
import { GoogleAuthentication } from '../application/google-authentication';
import { GoogleAuthenticationError } from '../domain/google-identity';

export class GoogleLoginDto {
  @ApiProperty() @IsString() @IsNotEmpty() @MaxLength(16384) idToken: string;
  @ApiPropertyOptional()
  @IsOptional()
  @IsString()
  @MaxLength(1024)
  existingPassword?: string;
}
export class GoogleLinkDto {
  @ApiProperty() @IsString() @IsNotEmpty() @MaxLength(16384) idToken: string;
  @ApiPropertyOptional()
  @IsOptional()
  @IsString()
  @MaxLength(1024)
  currentPassword?: string;
}

@ApiTags('Auth')
@Controller('auth/google')
export class GoogleAuthController {
  constructor(
    private readonly google: GoogleAuthentication,
    private readonly auth: AuthService,
  ) {}
  @Post()
  @Throttle({ default: { limit: 8, ttl: 60_000 } })
  async login(@Body() dto: GoogleLoginDto, @Req() request: Request) {
    try {
      return await this.auth.createGoogleSession(
        await this.google.login(dto.idToken, dto.existingPassword),
        request,
      );
    } catch (error) {
      this.translate(error);
    }
  }
  @Post('link')
  @Auth()
  @ApiBearerAuth()
  @Throttle({ default: { limit: 5, ttl: 60_000 } })
  async link(@GetUser() user: User, @Body() dto: GoogleLinkDto) {
    try {
      await this.google.link(user.id, dto.idToken, dto.currentPassword);
      return await this.auth.getProfile(user);
    } catch (error) {
      this.translate(error);
    }
  }
  private translate(error: unknown): never {
    if (!(error instanceof GoogleAuthenticationError)) throw error;
    const body = { code: error.code, message: error.message };
    if (error.code === 'GOOGLE_NOT_CONFIGURED')
      throw new ServiceUnavailableException(body);
    if (error.code === 'INVALID_GOOGLE_TOKEN')
      throw new UnauthorizedException(body);
    throw new ConflictException(body);
  }
}
