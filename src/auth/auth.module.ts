import { GoogleAuthentication } from './application/google-authentication';
import { GoogleTokenVerifier } from './infrastructure/google-identity-verifier';
import { TypeOrmGoogleAccountRepository } from './infrastructure/google-account-repository';
import { GoogleAuthController } from './presentation/google-auth.controller';
import { Global, Module } from '@nestjs/common';
import { JwtModule } from '@nestjs/jwt';
import { TypeOrmModule } from '@nestjs/typeorm';
import { PassportModule } from '@nestjs/passport';
import { ConfigModule, ConfigService } from '@nestjs/config';

import { AuthService } from './auth.service';
import { AuthController } from './auth.controller';
import { User } from './entities/user.entity';
import { JwtStrategy } from './strategies/jwt.strategy';
import { ClinicMembership } from '../clinic-memberships/entities/clinic-membership.entity';
import { ClinicScopeGuard } from './guards/clinic-scope.guard';
import { UserRoleGuard } from './guards/user-role.guard';
import { ClinicRoleGuard } from './guards/clinic-role.guard';
import { ClinicPermissionGuard } from './guards/clinic-permission.guard';
import { getRequiredEnv } from '../config/env';
import { ProfessionalSpecialty } from '../professional-specialties/entities/professional-specialty.entity';
import { UserSessionsModule } from '../user-sessions/user-sessions.module';
import { PasswordHasherService } from './services/password-hasher.service';
import { PasswordResetOtpService } from './services/password-reset-otp.service';

@Global()
@Module({
  controllers: [AuthController, GoogleAuthController],
  providers: [
    AuthService,
    GoogleTokenVerifier,
    TypeOrmGoogleAccountRepository,
    {
      provide: GoogleAuthentication,
      useFactory: (
        verifier: GoogleTokenVerifier,
        accounts: TypeOrmGoogleAccountRepository,
      ) => new GoogleAuthentication(verifier, accounts),
      inject: [GoogleTokenVerifier, TypeOrmGoogleAccountRepository],
    },
    JwtStrategy,
    ClinicScopeGuard,
    UserRoleGuard,
    ClinicRoleGuard,
    ClinicPermissionGuard,
    PasswordHasherService,
    PasswordResetOtpService,
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
          secret: getRequiredEnv(
            'JWT_SECRET',
            configService.get<string>('JWT_SECRET') ?? process.env.JWT_SECRET,
          ),
          signOptions: {
            expiresIn: '2h',
          },
        };
      },
    }),
  ],
  exports: [
    GoogleTokenVerifier,
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
