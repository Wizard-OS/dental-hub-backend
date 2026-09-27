import { IsEmail, IsString, Matches } from 'class-validator';
import { ApiProperty } from '@nestjs/swagger';

export class VerifyOtpDto {
  @ApiProperty({
    example: 'user@example.com',
    description: 'Correo electrónico del usuario',
  })
  @IsString()
  @IsEmail()
  email: string;

  @ApiProperty({
    example: '123456',
    description: 'Código OTP de 6 dígitos',
  })
  @IsString()
  @Matches(/^\d{6}$/, { message: 'OTP must be a 6-digit code' })
  otp: string;
}
