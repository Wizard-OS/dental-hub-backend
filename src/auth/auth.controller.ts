import { apiMessage } from '../common/i18n/api-message';
import {
  Controller,
  Delete,
  Get,
  Post,
  Patch,
  Body,
  Req,
  UploadedFile,
  UseInterceptors,
} from '@nestjs/common';
import type { Request } from 'express';
import type { Express } from 'express';
import { Throttle } from '@nestjs/throttler';
import {
  ApiTags,
  ApiOperation,
  ApiResponse,
  ApiBearerAuth,
  ApiConsumes,
  ApiBody,
} from '@nestjs/swagger';

import { AuthService } from './auth.service';
import { GetUser, Auth } from './decorators';
import { buildRequestBaseUrl } from '../common/http/request-url';
import { createUploadInterceptor } from '../common/files/upload-interceptors';

import {
  CreateUserDto,
  LoginUserDto,
  UpdateProfileDto,
  ChangePasswordDto,
  ForgotPasswordDto,
  VerifyOtpDto,
  ResetPasswordDto,
} from './dto';
import { User } from './entities/user.entity';

@ApiTags('Auth')
@Controller('auth')
export class AuthController {
  constructor(private readonly authService: AuthService) {}

  @Post('register')
  @Throttle({ default: { limit: 5, ttl: 60_000 } })
  @ApiOperation({ summary: 'Registrar nuevo usuario' })
  @ApiResponse({ status: 201, description: 'Usuario creado exitosamente' })
  @ApiResponse({ status: 400, description: 'Datos inválidos' })
  createUser(@Body() createUserDto: CreateUserDto, @Req() request: Request) {
    return this.authService.create(createUserDto, request);
  }

  @Post('login')
  @Throttle({ default: { limit: 8, ttl: 60_000 } })
  @ApiOperation({ summary: 'Iniciar sesión' })
  @ApiResponse({
    status: 201,
    description: 'Login exitoso — retorna token JWT',
  })
  @ApiResponse({ status: 401, description: 'Credenciales inválidas' })
  loginUser(@Body() loginUserDto: LoginUserDto, @Req() request: Request) {
    return this.authService.login(loginUserDto, request);
  }

  @Post('forgot-password')
  @Throttle({ default: { limit: 3, ttl: 60_000 } })
  @ApiOperation({ summary: 'Solicitar código OTP para recuperar contraseña' })
  @ApiResponse({
    status: 201,
    description: 'Si el email existe, se genera un código de recuperación',
  })
  forgotPassword(@Body() forgotPasswordDto: ForgotPasswordDto) {
    return this.authService.forgotPassword(forgotPasswordDto);
  }

  @Post('verify-otp')
  @Throttle({ default: { limit: 10, ttl: 60_000 } })
  @ApiOperation({ summary: 'Validar código OTP de recuperación' })
  @ApiResponse({ status: 201, description: 'OTP válido' })
  @ApiResponse({ status: 400, description: 'OTP inválido o expirado' })
  verifyOtp(@Body() verifyOtpDto: VerifyOtpDto) {
    return this.authService.verifyOtp(verifyOtpDto);
  }

  @Post('reset-password')
  @Throttle({ default: { limit: 5, ttl: 60_000 } })
  @ApiOperation({ summary: 'Restablecer contraseña usando OTP' })
  @ApiResponse({ status: 201, description: 'Contraseña restablecida' })
  @ApiResponse({ status: 400, description: 'OTP inválido o expirado' })
  resetPassword(@Body() resetPasswordDto: ResetPasswordDto) {
    return this.authService.resetPassword(resetPasswordDto);
  }

  @Get('check-status')
  @Auth()
  @ApiBearerAuth()
  @ApiOperation({ summary: 'Verificar estado de autenticación' })
  @ApiResponse({
    status: 200,
    description: 'Token válido — retorna usuario y nuevo token',
  })
  @ApiResponse({ status: 401, description: 'No autorizado' })
  checkAuthStatus(@GetUser() user: User) {
    return this.authService.checkAuthStatus(user);
  }

  @Post('profile-photo')
  @Throttle({ default: { limit: 10, ttl: 60_000 } })
  @Auth()
  @ApiBearerAuth()
  @ApiOperation({ summary: 'Subir foto de perfil' })
  @ApiConsumes('multipart/form-data')
  @ApiBody({
    schema: {
      type: 'object',
      properties: {
        file: {
          type: 'string',
          format: 'binary',
          description: 'Archivo de imagen (max 5 MB)',
        },
      },
    },
  })
  @ApiResponse({ status: 201, description: 'Foto subida exitosamente' })
  @ApiResponse({
    status: 400,
    description: 'Solo se permiten archivos de imagen',
  })
  @UseInterceptors(
    createUploadInterceptor({
      directory: 'profile-photos',
      maxSizeMb: 5,
      imageOnlyMessage: apiMessage('api.messages.only_image_files_are_allowed'),
      filename: (request) => {
        const userId =
          (request as Request & { user?: User }).user?.id ?? 'user';
        return `${userId}-${Date.now()}`;
      },
    }),
  )
  uploadProfilePhoto(
    @GetUser() user: User,
    @UploadedFile() file: Express.Multer.File,
    @Req() request: Request,
  ) {
    const baseUrl = buildRequestBaseUrl(request);
    return this.authService.updateProfilePhoto(user, file, baseUrl);
  }

  @Get('profile')
  @Auth()
  @ApiBearerAuth()
  @ApiOperation({ summary: 'Obtener perfil del usuario autenticado' })
  @ApiResponse({ status: 200, description: 'Perfil del usuario' })
  getProfile(@GetUser() user: User) {
    return this.authService.getProfile(user);
  }

  @Patch('profile')
  @Auth()
  @ApiBearerAuth()
  @ApiOperation({ summary: 'Actualizar perfil del usuario autenticado' })
  @ApiResponse({ status: 200, description: 'Perfil actualizado' })
  updateProfile(
    @GetUser() user: User,
    @Body() updateProfileDto: UpdateProfileDto,
  ) {
    return this.authService.updateProfile(user, updateProfileDto);
  }

  @Post('change-password')
  @Auth()
  @ApiBearerAuth()
  @ApiOperation({ summary: 'Cambiar contraseña' })
  @ApiResponse({ status: 201, description: 'Contraseña cambiada' })
  @ApiResponse({ status: 400, description: 'Contraseña actual incorrecta' })
  changePassword(
    @GetUser() user: User,
    @Body() changePasswordDto: ChangePasswordDto,
  ) {
    return this.authService.changePassword(user, changePasswordDto);
  }

  @Post('logout')
  @Auth()
  @ApiBearerAuth()
  @ApiOperation({ summary: 'Cerrar sesión' })
  @ApiResponse({ status: 201, description: 'Sesión cerrada' })
  logout(@GetUser() user: User) {
    return this.authService.logout(user);
  }

  @Delete('account')
  @Auth()
  @ApiBearerAuth()
  @ApiOperation({ summary: 'Eliminar cuenta del usuario autenticado' })
  @ApiResponse({ status: 200, description: 'Cuenta eliminada' })
  deleteAccount(@GetUser() user: User) {
    return this.authService.deleteAccount(user);
  }
}
