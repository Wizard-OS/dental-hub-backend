import { plainToInstance } from 'class-transformer';
import { validate } from 'class-validator';

import { ChangePasswordDto } from './change-password.dto';
import { CreateUserDto } from './create-user.dto';
import { LoginUserDto } from './login-user.dto';
import { ResetPasswordDto } from './reset-password.dto';

const registration = {
  email: 'doctor@example.com',
  firstName: 'Ana',
  lastName: 'Silva',
};

describe('password policy at HTTP boundaries', () => {
  it('accepts a passphrase without composition requirements', async () => {
    expect(
      await validate(
        plainToInstance(CreateUserDto, {
          ...registration,
          password: 'a long dental passphrase',
        }),
      ),
    ).toEqual([]);
  });

  it.each(['short', 'é'.repeat(37), 'a'.repeat(73)])(
    'rejects invalid new passwords',
    async (password) => {
      expect(
        await validate(
          plainToInstance(CreateUserDto, { ...registration, password }),
        ),
      ).not.toEqual([]);
    },
  );

  it('accepts exactly 72 UTF8 bytes', async () => {
    expect(
      await validate(
        plainToInstance(CreateUserDto, {
          ...registration,
          password: 'é'.repeat(36),
        }),
      ),
    ).toEqual([]);
  });

  it('accepts existing six-character and historically truncated Unicode credentials on login', async () => {
    for (const password of ['Abc123', 'é'.repeat(50)])
      expect(
        await validate(
          plainToInstance(LoginUserDto, {
            email: registration.email,
            password,
          }),
        ),
      ).toEqual([]);
  });

  it('enforces the same policy on change and reset', async () => {
    expect(
      await validate(
        plainToInstance(ChangePasswordDto, {
          currentPassword: 'Abc123',
          newPassword: 'a long dental passphrase',
        }),
      ),
    ).toEqual([]);
    expect(
      await validate(
        plainToInstance(ResetPasswordDto, {
          email: registration.email,
          otp: '123456',
          newPassword: 'a long dental passphrase',
        }),
      ),
    ).toEqual([]);
    expect(
      await validate(
        plainToInstance(ResetPasswordDto, {
          email: registration.email,
          otp: '123456',
          newPassword: 'Abc123',
        }),
      ),
    ).not.toEqual([]);
  });
});
