import { UserStorageIntegration } from '../storage/entities/user-storage-integration.entity';
import { StorageIntegrationStatus } from '../storage/interfaces/storage-integration-status.enum';
import {
  BadRequestException,
  Injectable,
  InternalServerErrorException,
  UnauthorizedException,
} from '@nestjs/common';
import { JwtService } from '@nestjs/jwt';
import { InjectRepository } from '@nestjs/typeorm';
import type { Request } from 'express';

import { Repository } from 'typeorm';
import { promises as fs } from 'fs';

import { JwtPayload } from './interfaces';
import { User } from './entities/user.entity';
import { ClinicMembership } from '../clinic-memberships/entities/clinic-membership.entity';
import { ProfessionalSpecialty } from '../professional-specialties/entities/professional-specialty.entity';
import { buildSessionMetadata } from '../user-sessions/device-metadata.util';
import { UserSessionsService } from '../user-sessions/user-sessions.service';
import {
  CreateUserDto,
  LoginUserDto,
  UpdateProfileDto,
  ChangePasswordDto,
  ForgotPasswordDto,
  VerifyOtpDto,
  ResetPasswordDto,
} from './dto';
import { validateAndNormalizeUploadedFile } from '../common/files/upload-validation';
import { PasswordHasherService } from './services/password-hasher.service';
import { PasswordResetOtpService } from './services/password-reset-otp.service';

@Injectable()
export class AuthService {
  constructor(
    @InjectRepository(User)
    private readonly userRepository: Repository<User>,

    @InjectRepository(ClinicMembership)
    private readonly clinicMembershipRepository: Repository<ClinicMembership>,

    @InjectRepository(ProfessionalSpecialty)
    private readonly specialtyRepository: Repository<ProfessionalSpecialty>,

    private readonly jwtService: JwtService,

    private readonly userSessionsService: UserSessionsService,

    private readonly passwordHasher: PasswordHasherService,

    private readonly passwordResetOtp: PasswordResetOtpService,
  ) {}

  async create(createUserDto: CreateUserDto, request?: Request) {
    try {
      const { password, ...userData } = createUserDto;

      const user = this.userRepository.create({
        ...userData,
        password: this.passwordHasher.hash(password),
      });

      await this.userRepository.save(user);
      // eslint-disable-next-line @typescript-eslint/no-unused-vars
      const { password: _, ...userWithoutPassword } = user;
      const session = await this.userSessionsService.createSession(
        user.id,
        request ? buildSessionMetadata(request) : {},
      );

      return this.buildAuthResponse(userWithoutPassword as User, session.id);
      // TODO: Retornar el JWT de acceso
    } catch (error) {
      this.handleDBErrors(error);
    }
  }

  async login(loginUserDto: LoginUserDto, request?: Request) {
    const { password, email } = loginUserDto;

    const user = await this.userRepository.findOne({
      where: { email: email.toLowerCase().trim() },
      select: {
        id: true,
        email: true,
        googleEmail: true,
        password: true,
        firstName: true,
        lastName: true,
        isActive: true,
        roles: true,
        phone: true,
        birthDate: true,
        professionalLicenseNumber: true,
        professionalSpecialtyId: true,
        rut: true,
        profilePhotoUrl: true,
        createdAt: true,
        updatedAt: true,
      },
    });

    if (!user || !user.isActive)
      throw new UnauthorizedException('Credentials are not valid');

    if (!user.password || !this.passwordHasher.compare(password, user.password))
      throw new UnauthorizedException('Credentials are not valid');

    const session = await this.userSessionsService.createSession(
      user.id,
      request ? buildSessionMetadata(request) : {},
    );

    return this.buildAuthResponse(user, session.id);
  }

  async createGoogleSession(userId: string, request: Request) {
    const user = await this.userRepository.findOneBy({
      id: userId,
      isActive: true,
    });
    if (!user) throw new UnauthorizedException('Account is inactive');
    const session = await this.userSessionsService.createSession(
      user.id,
      buildSessionMetadata(request),
    );
    return this.buildAuthResponse(user, session.id);
  }

  async checkAuthStatus(user: User) {
    return this.buildAuthResponse(user, this.requireCurrentSessionId(user));
  }

  async forgotPassword(forgotPasswordDto: ForgotPasswordDto) {
    const email = forgotPasswordDto.email.toLowerCase().trim();
    const user = await this.userRepository.findOne({
      where: { email },
      select: { id: true, email: true },
    });

    const genericResponse: { message: string; devOtp?: string } = {
      message: 'If the email exists, a password reset code has been sent',
    };

    if (!user) {
      return genericResponse;
    }

    const otp = this.passwordResetOtp.generate();
    const expiresAt = this.passwordResetOtp.expirationFrom();

    await this.userRepository.update(user.id, {
      passwordResetOtpHash: this.passwordHasher.hash(otp),
      passwordResetOtpExpiresAt: expiresAt,
      passwordResetOtpUsedAt: null,
      passwordResetOtpAttemptCount: 0,
      passwordResetOtpLockedUntil: null,
    });

    // TODO: Send the OTP through the configured email provider.
    if (this.passwordResetOtp.shouldExposeDevOtp()) {
      genericResponse.devOtp = otp;
      console.log(`Password reset OTP for ${email}: ${otp}`);
    }

    return genericResponse;
  }

  async verifyOtp(verifyOtpDto: VerifyOtpDto) {
    await this.assertValidPasswordResetOtp(
      verifyOtpDto.email,
      verifyOtpDto.otp,
    );

    return { message: 'OTP verified successfully' };
  }

  async resetPassword(resetPasswordDto: ResetPasswordDto) {
    const user = await this.assertValidPasswordResetOtp(
      resetPasswordDto.email,
      resetPasswordDto.otp,
    );

    await this.userRepository.update(user.id, {
      password: this.passwordHasher.hash(resetPasswordDto.newPassword),
      passwordResetOtpHash: null,
      passwordResetOtpExpiresAt: null,
      passwordResetOtpUsedAt: new Date(),
      passwordResetOtpAttemptCount: 0,
      passwordResetOtpLockedUntil: null,
    });

    return { message: 'Password reset successfully' };
  }

  async updateProfilePhoto(
    user: User,
    file: Express.Multer.File,
    baseUrl: string,
  ) {
    if (!file) {
      throw new BadRequestException('No file uploaded');
    }

    try {
      await validateAndNormalizeUploadedFile(file, ['image']);
    } catch (error) {
      await fs.unlink(file.path).catch(() => undefined);
      throw error;
    }

    const profilePhotoUrl = `${baseUrl}/uploads/profile-photos/${file.filename}`;
    await this.userRepository.update(user.id, { profilePhotoUrl });

    const updatedUser = await this.userRepository.findOne({
      where: { id: user.id },
    });

    if (!updatedUser) {
      throw new InternalServerErrorException('User not found');
    }

    return this.buildAuthResponse(
      updatedUser,
      this.requireCurrentSessionId(user),
    );
  }

  async updateProfile(user: User, updateProfileDto: UpdateProfileDto) {
    const { email, birthDate, professionalSpecialtyId, ...rest } =
      updateProfileDto;

    if (email && email !== user.email) {
      const existing = await this.userRepository.findOne({
        where: { email: email.toLowerCase().trim() },
      });
      if (existing && existing.id !== user.id) {
        throw new BadRequestException('Email already in use');
      }
    }

    if (professionalSpecialtyId) {
      const specialty = await this.specialtyRepository.findOne({
        where: { id: professionalSpecialtyId, isActive: true },
      });
      if (!specialty) {
        throw new BadRequestException('Professional specialty is not valid');
      }
    }

    await this.userRepository.update(user.id, {
      ...rest,
      ...(email ? { email: email.toLowerCase().trim() } : {}),
      ...(birthDate ? { birthDate: new Date(birthDate) } : {}),
      ...(professionalSpecialtyId ? { professionalSpecialtyId } : {}),
    });

    const updatedUser = await this.userRepository.findOne({
      where: { id: user.id },
    });

    if (!updatedUser) {
      throw new InternalServerErrorException('User not found after update');
    }

    return this.buildAuthResponse(
      updatedUser,
      this.requireCurrentSessionId(user),
    );
  }

  async changePassword(user: User, changePasswordDto: ChangePasswordDto) {
    const { currentPassword, newPassword } = changePasswordDto;

    const userWithPassword = await this.userRepository.findOne({
      where: { id: user.id },
      select: { id: true, password: true },
    });

    if (!userWithPassword) {
      throw new InternalServerErrorException('User not found');
    }

    if (
      !userWithPassword.password ||
      !this.passwordHasher.compare(currentPassword, userWithPassword.password)
    ) {
      throw new UnauthorizedException('Current password is incorrect');
    }

    await this.userRepository.update(user.id, {
      password: this.passwordHasher.hash(newPassword),
    });

    return {
      message: 'Password changed successfully',
      token: this.getJwtToken({
        id: user.id,
        sessionId: this.requireCurrentSessionId(user),
      }),
    };
  }

  async getProfile(user: User) {
    const fullUser = await this.userRepository.findOne({
      where: { id: user.id },
    });

    if (!fullUser) {
      throw new InternalServerErrorException('User not found');
    }

    return this.buildAuthResponse(fullUser, this.requireCurrentSessionId(user));
  }

  logout(user: User) {
    return this.userSessionsService.revokeCurrentSession(
      user.id,
      this.requireCurrentSessionId(user),
    );
  }

  async deleteAccount(user: User) {
    const currentSessionId = this.requireCurrentSessionId(user);

    await this.userRepository.manager
      .getRepository(UserStorageIntegration)
      .update(
        { userId: user.id },
        {
          status: StorageIntegrationStatus.DISCONNECTED,
          encryptedAccessToken: null,
          encryptedRefreshToken: null,
          tokenExpiresAt: null,
        },
      );

    await this.userRepository.update(user.id, {
      isActive: false,
      passwordResetOtpHash: null,
      passwordResetOtpExpiresAt: null,
      passwordResetOtpUsedAt: null,
      passwordResetOtpAttemptCount: 0,
      passwordResetOtpLockedUntil: null,
    });
    await this.userSessionsService.revokeAllOtherSessions(
      user.id,
      currentSessionId,
    );
    await this.userSessionsService.revokeCurrentSession(
      user.id,
      currentSessionId,
    );

    return { message: 'Account deleted successfully' };
  }

  private getJwtToken(payload: JwtPayload) {
    return this.jwtService.sign(payload);
  }

  private async assertValidPasswordResetOtp(email: string, otp: string) {
    const user = await this.userRepository.findOne({
      where: { email: email.toLowerCase().trim() },
      select: {
        id: true,
        email: true,
        passwordResetOtpHash: true,
        passwordResetOtpExpiresAt: true,
        passwordResetOtpUsedAt: true,
        passwordResetOtpAttemptCount: true,
        passwordResetOtpLockedUntil: true,
      },
    });

    if (
      !user ||
      !user.passwordResetOtpHash ||
      !user.passwordResetOtpExpiresAt ||
      user.passwordResetOtpUsedAt
    ) {
      throw new BadRequestException('Invalid or expired OTP');
    }

    if (
      user.passwordResetOtpLockedUntil &&
      user.passwordResetOtpLockedUntil.getTime() > Date.now()
    ) {
      throw new BadRequestException('Invalid or expired OTP');
    }

    if (user.passwordResetOtpExpiresAt.getTime() <= Date.now()) {
      throw new BadRequestException('Invalid or expired OTP');
    }

    if (!this.passwordHasher.compare(otp, user.passwordResetOtpHash)) {
      await this.userRepository.update(
        user.id,
        this.passwordResetOtp.nextFailedAttemptState(
          user.passwordResetOtpAttemptCount,
        ),
      );
      throw new BadRequestException('Invalid or expired OTP');
    }

    if (user.passwordResetOtpAttemptCount) {
      await this.userRepository.update(user.id, {
        passwordResetOtpAttemptCount: 0,
        passwordResetOtpLockedUntil: null,
      });
    }

    return user;
  }

  private async buildAuthResponse(user: User, sessionId: string) {
    const userWithoutPassword = { ...user } as Partial<User>;
    delete userWithoutPassword.password;
    delete userWithoutPassword.googleSubject;
    const credentials = await this.userRepository.findOne({
      where: { id: user.id },
      select: { id: true, password: true },
    });

    return {
      ...userWithoutPassword,
      hasPassword: Boolean(credentials?.password),
      memberships: await this.getActiveMemberships(user.id),
      token: this.getJwtToken({ id: user.id, sessionId }),
    };
  }

  private requireCurrentSessionId(user: User) {
    if (!user.currentSessionId) {
      throw new UnauthorizedException('Session not valid');
    }

    return user.currentSessionId;
  }

  private async getActiveMemberships(userId: string) {
    const memberships = await this.clinicMembershipRepository.find({
      where: { userId, isActive: true, clinic: { isActive: true } },
      relations: { clinic: true },
      order: { createdAt: 'ASC' },
    });

    return memberships.map((membership) => ({
      clinicId: membership.clinicId,
      clinicName: membership.clinic.name,
      clinicCountryCode: membership.clinic.countryCode,
      clinicCountryName: membership.clinic.countryName,
      clinicCurrency: membership.clinic.currency,
      clinicCallingCodes: membership.clinic.callingCodes,
      clinicDefaultCallingCode: membership.clinic.defaultCallingCode,
      membershipId: membership.id,
      role: membership.role,
      permissionsJson: membership.permissionsJson ?? {},
    }));
  }

  private handleDBErrors(error: unknown): never {
    if (
      typeof error === 'object' &&
      error !== null &&
      'code' in error &&
      error.code === '23505'
    ) {
      const detail =
        'detail' in error && typeof error.detail === 'string'
          ? error.detail
          : undefined;
      throw new BadRequestException(detail);
    }

    console.log(error);

    throw new InternalServerErrorException('Please check server logs');
  }
}
