import { ApiProperty } from '@nestjs/swagger';

import { Gender } from '../../interfaces/gender.enum';

export class PatientGenderOptionResponseDto {
  @ApiProperty({ enum: Gender, enumName: 'Gender', example: Gender.MALE })
  value!: Gender;

  @ApiProperty({ example: 'Hombre' })
  label!: string;
}
