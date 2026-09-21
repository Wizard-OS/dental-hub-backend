import { PartialType } from '@nestjs/swagger';

import { CreateProfessionalSpecialtyDto } from './create-professional-specialty.dto';

export class UpdateProfessionalSpecialtyDto extends PartialType(
  CreateProfessionalSpecialtyDto,
) {}
