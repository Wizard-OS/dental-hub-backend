import { Global, Module } from '@nestjs/common';
import { ConfigModule, ConfigService } from '@nestjs/config';
import { APP_GUARD } from '@nestjs/core';
import { JwtModule } from '@nestjs/jwt';
import { PassportModule } from '@nestjs/passport';
import { TypeOrmModule } from '@nestjs/typeorm';

import { ClinicMembership } from '../clinic-memberships/entities/clinic-membership.entity';
import { getJwtSecret } from '../config/security';
import { ProfessionalSpecialty } from '../professional-specialties/entities/professional-specialty.entity';
import { UserSessionsModule } from '../user-sessions/user-sessions.module';
import { AUTH_SECURITY_TRANSACTION } from './application/ports/auth-security-transaction.port';
import { AuthController } from './auth.controller';
import { AuthService } from './auth.service';
import { User } from './entities/user.entity';
import { ClinicPermissionGuard } from './guards/clinic-permission.guard';
import { ClinicRoleGuard } from './guards/clinic-role.guard';
import { ClinicScopeGuard } from './guards/clinic-scope.guard';
import { JwtAuthGuard } from './guards/jwt-auth.guard';
import { UserRoleGuard } from './guards/user-role.guard';
import { TypeOrmAuthSecurityTransactionAdapter } from './infrastructure/typeorm-auth-security-transaction.adapter';
import { PasswordHasherService } from './services/password-hasher.service';
import { PasswordResetEmailProvider } from './services/password-reset-email.provider';
import { PasswordResetOtpService } from './services/password-reset-otp.service';
import { JwtStrategy } from './strategies/jwt.strategy';

@Global()
@Module({
  controllers: [AuthController],
  providers: [
    AuthService,
    { provide: APP_GUARD, useClass: JwtAuthGuard },
    JwtStrategy,
    ClinicScopeGuard,
    UserRoleGuard,
    ClinicRoleGuard,
    ClinicPermissionGuard,
    PasswordHasherService,
    PasswordResetOtpService,
    PasswordResetEmailProvider,
    TypeOrmAuthSecurityTransactionAdapter,
    {
      provide: AUTH_SECURITY_TRANSACTION,
      useExisting: TypeOrmAuthSecurityTransactionAdapter,
    },
  ],
  imports: [
    ConfigModule,
    UserSessionsModule,

    TypeOrmModule.forFeature([User, ClinicMembership, ProfessionalSpecialty]),

    PassportModule.register({ defaultStrategy: 'jwt' }),

    JwtModule.registerAsync({
      imports: [ConfigModule],
      inject: [ConfigService],
      useFactory: (configService: ConfigService) => {
        return {
          secret: getJwtSecret(
            configService.get<string>('JWT_SECRET') ?? process.env.JWT_SECRET,
          ),
          signOptions: {
            expiresIn: '2h',
            algorithm: 'HS256',
          },
        };
      },
    }),
  ],
  exports: [
    TypeOrmModule,
    JwtStrategy,
    PassportModule,
    JwtModule,
    ClinicScopeGuard,
    UserRoleGuard,
    ClinicRoleGuard,
    ClinicPermissionGuard,
  ],
})
export class AuthModule {}
