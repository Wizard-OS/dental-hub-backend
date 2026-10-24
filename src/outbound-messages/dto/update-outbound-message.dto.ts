import { PartialType } from '@nestjs/swagger';

import { CreateOutboundMessageDto } from './create-outbound-message.dto';

export class UpdateOutboundMessageDto extends PartialType(
  CreateOutboundMessageDto,
) {}
