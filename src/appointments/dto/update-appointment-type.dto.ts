import { PartialType } from '@nestjs/swagger';
import { CreateAppointmentTypeDto } from './create-appointment-type.dto';

export class UpdateAppointmentTypeDto extends PartialType(
  CreateAppointmentTypeDto,
  { skipNullProperties: false },
) {}
