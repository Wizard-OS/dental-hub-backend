import { apiMessage, type ApiMessage } from '../common/i18n/api-message';
import { UserStorageIntegration } from '../storage/entities/user-storage-integration.entity';
import { StorageIntegrationStatus } from '../storage/interfaces/storage-integration-status.enum';
import {
  BadRequestException,
  Inject,
  Injectable,
  InternalServerErrorException,
  Logger,
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
import { PasswordResetEmailProvider } from './services/password-reset-email.provider';
import { AUTH_SECURITY_TRANSACTION } from './application/ports/auth-security-transaction.port';
import type {
  AuthSecurityAccount,
  AuthSecurityTransactionPort,
} from './application/ports/auth-security-transaction.port';

@Injectable()
export class AuthService {
  private readonly logger = new Logger(AuthService.name);

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

    private readonly passwordResetEmail: PasswordResetEmailProvider,

    @Inject(AUTH_SECURITY_TRANSACTION)
    private readonly securityTransactions: AuthSecurityTransactionPort,
  ) {}

  async create(createUserDto: CreateUserDto, request?: Request) {
    try {
      const { password, ...userData } = createUserDto;

      const user = this.userRepository.create({
        ...userData,
        password: await this.passwordHasher.hash(password),
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
      throw new UnauthorizedException(
        apiMessage('api.messages.credentials_are_not_valid'),
      );

    const session = await this.createLoginSession(
      user.id,
      password,
      request ? buildSessionMetadata(request) : {},
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

    const genericResponse: { message: ApiMessage; devOtp?: string } = {
      message: apiMessage(
        'api.messages.if_the_email_exists_a_password_reset_code_has_been_sent',
      ),
    };

    if (!user) {
      return genericResponse;
    }

    const otp = this.passwordResetOtp.generate();
    const otpHash = await this.passwordHasher.hash(otp);
    await this.securityTransactions.withLockedAccountById(
      user.id,
      async (lockedAccount) => {
        if (!lockedAccount) return;
        const { account } = lockedAccount;
        const lockStillActive =
          account.passwordResetOtpLockedUntil &&
          account.passwordResetOtpLockedUntil.getTime() > Date.now();
        const resetWindowExpired =
          !account.passwordResetOtpExpiresAt ||
          account.passwordResetOtpExpiresAt.getTime() <= Date.now();
        await lockedAccount.update({
          passwordResetOtpHash: otpHash,
          passwordResetOtpExpiresAt: this.passwordResetOtp.expirationFrom(),
          passwordResetOtpUsedAt: null,
          passwordResetOtpAttemptCount:
            resetWindowExpired && !lockStillActive
              ? 0
              : account.passwordResetOtpAttemptCount,
          passwordResetOtpLockedUntil: lockStillActive
            ? account.passwordResetOtpLockedUntil
            : null,
        });
      },
    );

    if (this.passwordResetEmail.configured) {
      try {
        await this.passwordResetEmail.sendCode(email, otp);
      } catch {
        this.logger.error('Password reset email delivery failed');
      }
    }

    if (this.passwordResetOtp.shouldExposeDevOtp()) {
      genericResponse.devOtp = otp;
    }

    return genericResponse;
  }

  async verifyOtp(verifyOtpDto: VerifyOtpDto) {
    const valid = await this.checkPasswordResetOtp(
      verifyOtpDto.email,
      verifyOtpDto.otp,
    );
    if (!valid) this.throwInvalidOtp();

    return { message: apiMessage('api.messages.otp_verified_successfully') };
  }

  async resetPassword(resetPasswordDto: ResetPasswordDto) {
    const passwordHash = await this.passwordHasher.hash(
      resetPasswordDto.newPassword,
    );
    const reset = await this.securityTransactions.withLockedAccountByEmail(
      resetPasswordDto.email,
      async (lockedAccount) => {
        const account = lockedAccount?.account ?? null;
        if (
          !lockedAccount ||
          !(await this.isPasswordResetOtpValid(account, resetPasswordDto.otp))
        ) {
          if (
            lockedAccount &&
            this.canAttemptPasswordResetOtp(lockedAccount.account)
          ) {
            await lockedAccount.update(
              this.passwordResetOtp.nextFailedAttemptState(
                lockedAccount.account.passwordResetOtpAttemptCount,
              ),
            );
          }
          return false;
        }

        await lockedAccount.update({
          password: passwordHash,
          passwordResetOtpHash: null,
          passwordResetOtpExpiresAt: null,
          passwordResetOtpUsedAt: new Date(),
          passwordResetOtpAttemptCount: 0,
          passwordResetOtpLockedUntil: null,
        });
        await lockedAccount.revokeSessions();
        return true;
      },
    );
    if (!reset) this.throwInvalidOtp();

    return { message: apiMessage('api.messages.password_reset_successfully') };
  }

  async updateProfilePhoto(
    user: User,
    file: Express.Multer.File,
    baseUrl: string,
  ) {
    if (!file) {
      throw new BadRequestException(
        apiMessage('api.messages.no_file_uploaded'),
      );
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
      throw new InternalServerErrorException(
        apiMessage('api.messages.user_not_found'),
      );
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
        throw new BadRequestException(
          apiMessage('api.messages.email_already_in_use'),
        );
      }
    }

    if (professionalSpecialtyId) {
      const specialty = await this.specialtyRepository.findOne({
        where: { id: professionalSpecialtyId, isActive: true },
      });
      if (!specialty) {
        throw new BadRequestException(
          apiMessage('api.messages.professional_specialty_is_not_valid'),
        );
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
      throw new InternalServerErrorException(
        apiMessage('api.messages.user_not_found_after_update'),
      );
    }

    return this.buildAuthResponse(
      updatedUser,
      this.requireCurrentSessionId(user),
    );
  }

  async changePassword(user: User, changePasswordDto: ChangePasswordDto) {
    const { currentPassword, newPassword } = changePasswordDto;

    const newPasswordHash = await this.passwordHasher.hash(newPassword);
    const sessionId = this.requireCurrentSessionId(user);
    await this.securityTransactions.withLockedAccountById(
      user.id,
      async (lockedAccount) => {
        const account = lockedAccount?.account;
        if (
          !lockedAccount ||
          !account?.password ||
          !(await this.passwordHasher.compare(
            currentPassword,
            account.password,
          ))
        ) {
          throw new UnauthorizedException(
            apiMessage('api.messages.current_password_is_incorrect'),
          );
        }
        await lockedAccount.update({
          password: newPasswordHash,
        });
        await lockedAccount.revokeSessions(sessionId);
      },
    );

    return {
      message: apiMessage('api.messages.password_changed_successfully'),
      token: this.getJwtToken({
        id: user.id,
        sessionId,
      }),
    };
  }

  async getProfile(user: User) {
    const fullUser = await this.userRepository.findOne({
      where: { id: user.id },
    });

    if (!fullUser) {
      throw new InternalServerErrorException(
        apiMessage('api.messages.user_not_found'),
      );
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

    return { message: apiMessage('api.messages.account_deleted_successfully') };
  }

  private getJwtToken(payload: JwtPayload) {
    return this.jwtService.sign(payload);
  }

  private async checkPasswordResetOtp(email: string, otp: string) {
    return this.securityTransactions.withLockedAccountByEmail(
      email,
      async (lockedAccount) => {
        const account = lockedAccount?.account ?? null;
        if (
          !lockedAccount ||
          !(await this.isPasswordResetOtpValid(account, otp))
        ) {
          if (
            lockedAccount &&
            this.canAttemptPasswordResetOtp(lockedAccount.account)
          ) {
            await lockedAccount.update(
              this.passwordResetOtp.nextFailedAttemptState(
                lockedAccount.account.passwordResetOtpAttemptCount,
              ),
            );
          }
          return false;
        }

        if (account?.passwordResetOtpAttemptCount) {
          await lockedAccount.update({
            passwordResetOtpAttemptCount: 0,
            passwordResetOtpLockedUntil: null,
          });
        }
        return true;
      },
    );
  }

  private canAttemptPasswordResetOtp(user: AuthSecurityAccount) {
    return Boolean(
      user.passwordResetOtpHash &&
      user.passwordResetOtpExpiresAt &&
      user.passwordResetOtpExpiresAt.getTime() > Date.now() &&
      !user.passwordResetOtpUsedAt &&
      (!user.passwordResetOtpLockedUntil ||
        user.passwordResetOtpLockedUntil.getTime() <= Date.now()),
    );
  }

  private async isPasswordResetOtpValid(
    user: AuthSecurityAccount | null,
    otp: string,
  ) {
    return Boolean(
      user &&
      user.passwordResetOtpHash &&
      user.passwordResetOtpExpiresAt &&
      user.passwordResetOtpExpiresAt.getTime() > Date.now() &&
      !user.passwordResetOtpUsedAt &&
      (!user.passwordResetOtpLockedUntil ||
        user.passwordResetOtpLockedUntil.getTime() <= Date.now()) &&
      (await this.passwordHasher.compare(otp, user.passwordResetOtpHash)),
    );
  }

  private throwInvalidOtp(): never {
    throw new BadRequestException(
      apiMessage('api.messages.invalid_or_expired_otp'),
    );
  }

  private async createLoginSession(
    userId: string,
    password: string,
    metadata: ReturnType<typeof buildSessionMetadata> | Record<string, never>,
  ) {
    return this.securityTransactions.withLockedAccountById(
      userId,
      async (lockedAccount) => {
        const user = lockedAccount?.account;
        if (
          !lockedAccount ||
          !user?.password ||
          !user.isActive ||
          !(await this.passwordHasher.compare(password, user.password))
        ) {
          throw new UnauthorizedException(
            apiMessage('api.messages.credentials_are_not_valid'),
          );
        }
        return { id: await lockedAccount.createSession(metadata) };
      },
    );
  }

  private async buildAuthResponse(user: User, sessionId: string) {
    const userWithoutPassword = { ...user } as Partial<User>;
    delete userWithoutPassword.password;
    delete userWithoutPassword.googleSubject;
    delete userWithoutPassword.googleEmail;
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
      throw new UnauthorizedException(
        apiMessage('api.messages.session_not_valid'),
      );
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
      throw new BadRequestException(
        apiMessage('api.messages.duplicate_record'),
      );
    }

    console.log(error);

    throw new InternalServerErrorException(
      apiMessage('api.messages.please_check_server_logs'),
    );
  }
}
