import { BadRequestException, UnauthorizedException } from '@nestjs/common';
import * as bcrypt from 'bcrypt';

import { AuthService } from './auth.service';
import { User } from './entities/user.entity';
import { ValidRoles } from './interfaces';

describe('AuthService password reset', () => {
  let service: AuthService;
  let users: Map<string, User>;
  let specialties: Map<string, { id: string; isActive: boolean }>;

  const userId = 'user-1';
  const email = 'doctor@dentalhub.test';

  beforeEach(() => {
    users = new Map<string, User>();
    specialties = new Map<string, { id: string; isActive: boolean }>();
    specialties.set('specialty-1', { id: 'specialty-1', isActive: true });
    users.set(userId, {
      id: userId,
      email,
      password: bcrypt.hashSync('OldPass1', 10),
      firstName: 'Ana',
      lastName: 'Silva',
      isActive: true,
      roles: [ValidRoles.odontologist],
      appointments: [],
      clinicalNotes: [],
      memberships: [],
      createdAt: new Date(),
      updatedAt: new Date(),
      checkFieldsBeforeInsert: jest.fn(),
      checkFieldsBeforeUpdate: jest.fn(),
    });

    const userRepository = {
      findOne: jest.fn(
        ({ where }: { where: { id?: string; email?: string } }) => {
          if (where.id) return users.get(where.id) ?? null;
          if (where.email) {
            return (
              [...users.values()].find((user) => user.email === where.email) ??
              null
            );
          }
          return null;
        },
      ),
      update: jest.fn((id: string, patch: Partial<User>) => {
        const user = users.get(id);
        if (!user) return { affected: 0 };
        Object.assign(user, patch);
        return { affected: 1 };
      }),
    };

    const clinicMembershipRepository = {
      find: jest.fn(() => []),
    };

    const specialtyRepository = {
      findOne: jest.fn(
        ({ where }: { where: { id?: string; isActive?: boolean } }) => {
          if (!where.id) return null;
          const specialty = specialties.get(where.id);
          if (!specialty) return null;
          if (
            where.isActive !== undefined &&
            specialty.isActive !== where.isActive
          ) {
            return null;
          }
          return specialty;
        },
      ),
    };

    const jwtService = {
      sign: jest.fn(() => 'jwt-token'),
    };

    service = new AuthService(
      userRepository as never,
      clinicMembershipRepository as never,
      specialtyRepository as never,
      jwtService as never,
    );
  });

  it('returns a generic response when requesting reset for an unknown email', async () => {
    await expect(
      service.forgotPassword({ email: 'missing@dentalhub.test' }),
    ).resolves.toEqual({
      message: 'If the email exists, a password reset code has been sent',
    });
  });

  it('verifies a valid OTP without changing the password', async () => {
    const response = await service.forgotPassword({ email });
    const otp = response.devOtp;

    expect(otp).toMatch(/^\d{4}$/);
    await expect(service.verifyOtp({ email, otp: otp! })).resolves.toEqual({
      message: 'OTP verified successfully',
    });
    await expect(
      service.login({ email, password: 'OldPass1' }),
    ).resolves.toMatchObject({ email, token: 'jwt-token' });
  });

  it('resets password, invalidates OTP, and rejects the old password', async () => {
    const response = await service.forgotPassword({ email });
    const otp = response.devOtp!;

    await expect(
      service.resetPassword({ email, otp, newPassword: 'NewPass1' }),
    ).resolves.toEqual({ message: 'Password reset successfully' });

    await expect(service.verifyOtp({ email, otp })).rejects.toBeInstanceOf(
      BadRequestException,
    );
    await expect(
      service.login({ email, password: 'OldPass1' }),
    ).rejects.toBeInstanceOf(UnauthorizedException);
    await expect(
      service.login({ email, password: 'NewPass1' }),
    ).resolves.toMatchObject({ email, token: 'jwt-token' });
  });

  it('rejects expired OTP codes', async () => {
    const response = await service.forgotPassword({ email });
    const user = users.get(userId)!;
    user.passwordResetOtpExpiresAt = new Date(Date.now() - 1000);

    await expect(
      service.verifyOtp({ email, otp: response.devOtp! }),
    ).rejects.toBeInstanceOf(BadRequestException);
  });

  it('updates extended profile fields', async () => {
    await expect(
      service.updateProfile(users.get(userId)!, {
        phone: '+598 95 123 456',
        birthDate: '1988-05-12T00:00:00.000Z',
        professionalLicenseNumber: 'CJPPU-12345',
        professionalSpecialtyId: 'specialty-1',
        rut: '210000000018',
      }),
    ).resolves.toMatchObject({
      phone: '+598 95 123 456',
      professionalLicenseNumber: 'CJPPU-12345',
      professionalSpecialtyId: 'specialty-1',
      rut: '210000000018',
      token: 'jwt-token',
    });

    expect(users.get(userId)!.birthDate).toEqual(
      new Date('1988-05-12T00:00:00.000Z'),
    );
  });

  it('rejects inactive or unknown professional specialties', async () => {
    specialties.set('inactive-specialty', {
      id: 'inactive-specialty',
      isActive: false,
    });

    await expect(
      service.updateProfile(users.get(userId)!, {
        professionalSpecialtyId: 'inactive-specialty',
      }),
    ).rejects.toBeInstanceOf(BadRequestException);
  });
});
