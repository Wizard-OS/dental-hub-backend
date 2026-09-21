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

@Global()
@Module({
  controllers: [AuthController],
  providers: [
    AuthService,
    JwtStrategy,
    ClinicScopeGuard,
    UserRoleGuard,
    ClinicRoleGuard,
    ClinicPermissionGuard,
  ],
  imports: [
    ConfigModule,

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
