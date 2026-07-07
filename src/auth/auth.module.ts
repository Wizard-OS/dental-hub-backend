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

@Global()
@Module({
  controllers: [AuthController],
  providers: [
    AuthService,
    JwtStrategy,
    ClinicScopeGuard,
    UserRoleGuard,
    ClinicRoleGuard,
  ],
  imports: [
    ConfigModule,

    TypeOrmModule.forFeature([User, ClinicMembership]),

    PassportModule.register({ defaultStrategy: 'jwt' }),

    JwtModule.registerAsync({
      imports: [ConfigModule],
      inject: [ConfigService],
      useFactory: (configService: ConfigService) => {
        // console.log('JWT Secret', configService.get('JWT_SECRET') )
        // console.log('JWT SECRET', process.env.JWT_SECRET)
        return {
          secret: configService.get('JWT_SECRET'),
          signOptions: {
            expiresIn: '2h',
          },
        };
      },
    }),
    // JwtModule.register({
    // secret: process.env.JWT_SECRET,
    // signOptions: {
    //   expiresIn:'2h'
    // }
    // })
  ],
  exports: [
    TypeOrmModule,
    JwtStrategy,
    PassportModule,
    JwtModule,
    ClinicScopeGuard,
    UserRoleGuard,
    ClinicRoleGuard,
  ],
})
export class AuthModule {}
