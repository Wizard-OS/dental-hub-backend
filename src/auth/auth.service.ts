import {
  BadRequestException,
  Injectable,
  InternalServerErrorException,
  UnauthorizedException,
} from '@nestjs/common';
import { JwtService } from '@nestjs/jwt';
import { InjectRepository } from '@nestjs/typeorm';

import * as bcrypt from 'bcrypt';
import { randomInt } from 'crypto';
import { Repository } from 'typeorm';

import { JwtPayload } from './interfaces';
import { User } from './entities/user.entity';
import { ClinicMembership } from '../clinic-memberships/entities/clinic-membership.entity';
import { ProfessionalSpecialty } from '../professional-specialties/entities/professional-specialty.entity';
import {
  CreateUserDto,
  LoginUserDto,
  UpdateProfileDto,
  ChangePasswordDto,
  ForgotPasswordDto,
  VerifyOtpDto,
  ResetPasswordDto,
} from './dto';

@Injectable()
export class AuthService {
  private static readonly passwordResetOtpTtlMs = 10 * 60 * 1000;

  constructor(
    @InjectRepository(User)
    private readonly userRepository: Repository<User>,

    @InjectRepository(ClinicMembership)
    private readonly clinicMembershipRepository: Repository<ClinicMembership>,

    @InjectRepository(ProfessionalSpecialty)
    private readonly specialtyRepository: Repository<ProfessionalSpecialty>,

    private readonly jwtService: JwtService,
  ) {}

  async create(createUserDto: CreateUserDto) {
    try {
      const { password, ...userData } = createUserDto;

      const user = this.userRepository.create({
        ...userData,
        password: bcrypt.hashSync(password, 10),
      });

      await this.userRepository.save(user);
      // eslint-disable-next-line @typescript-eslint/no-unused-vars
      const { password: _, ...userWithoutPassword } = user;

      return this.buildAuthResponse(userWithoutPassword as User);
      // TODO: Retornar el JWT de acceso
    } catch (error) {
      this.handleDBErrors(error);
    }
  }

  async login(loginUserDto: LoginUserDto) {
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

    if (!user)
      throw new UnauthorizedException('Credentials are not valid (email)');

    if (!bcrypt.compareSync(password, user.password))
      throw new UnauthorizedException('Credentials are not valid (password)');

    return this.buildAuthResponse(user);
  }

  async checkAuthStatus(user: User) {
    return this.buildAuthResponse(user);
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

    const otp = randomInt(0, 10000).toString().padStart(4, '0');
    const expiresAt = new Date(Date.now() + AuthService.passwordResetOtpTtlMs);

    await this.userRepository.update(user.id, {
      passwordResetOtpHash: bcrypt.hashSync(otp, 10),
      passwordResetOtpExpiresAt: expiresAt,
      passwordResetOtpUsedAt: null,
    });

    // TODO: Send the OTP through the configured email provider.
    if (process.env.NODE_ENV !== 'production') {
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
      password: bcrypt.hashSync(resetPasswordDto.newPassword, 10),
      passwordResetOtpHash: null,
      passwordResetOtpExpiresAt: null,
      passwordResetOtpUsedAt: new Date(),
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

    const profilePhotoUrl = `${baseUrl}/uploads/profile-photos/${file.filename}`;
    await this.userRepository.update(user.id, { profilePhotoUrl });

    const updatedUser = await this.userRepository.findOne({
      where: { id: user.id },
    });

    if (!updatedUser) {
      throw new InternalServerErrorException('User not found');
    }

    return this.buildAuthResponse(updatedUser);
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

    return this.buildAuthResponse(updatedUser);
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

    if (!bcrypt.compareSync(currentPassword, userWithPassword.password)) {
      throw new UnauthorizedException('Current password is incorrect');
    }

    await this.userRepository.update(user.id, {
      password: bcrypt.hashSync(newPassword, 10),
    });

    return {
      message: 'Password changed successfully',
      token: this.getJwtToken({ id: user.id }),
    };
  }

  async getProfile(user: User) {
    const fullUser = await this.userRepository.findOne({
      where: { id: user.id },
    });

    if (!fullUser) {
      throw new InternalServerErrorException('User not found');
    }

    return this.buildAuthResponse(fullUser);
  }

  logout() {
    return {
      message: 'Logged out successfully',
    };
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

    if (user.passwordResetOtpExpiresAt.getTime() <= Date.now()) {
      throw new BadRequestException('Invalid or expired OTP');
    }

    if (!bcrypt.compareSync(otp, user.passwordResetOtpHash)) {
      throw new BadRequestException('Invalid or expired OTP');
    }

    return user;
  }

  private async buildAuthResponse(user: User) {
    const userWithoutPassword = { ...user } as Omit<User, 'password'> & {
      password?: string;
    };
    delete userWithoutPassword.password;

    return {
      ...userWithoutPassword,
      memberships: await this.getActiveMemberships(user.id),
      token: this.getJwtToken({ id: user.id }),
    };
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

  private handleDBErrors(error: any): never {
    if (error.code === '23505') throw new BadRequestException(error.detail);

    console.log(error);

    throw new InternalServerErrorException('Please check server logs');
  }
}
