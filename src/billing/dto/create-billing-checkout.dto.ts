import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';
import {
  IsEnum,
  IsOptional,
  IsBoolean,
  IsString,
  MaxLength,
  IsUUID,
  Equals,
} from 'class-validator';

import { MembershipPlanCode } from '../../membership/interfaces/membership-plan-code.enum';
import { BillingInterval } from '../interfaces/billing-interval.enum';

export class CreateBillingCheckoutDto {
  @ApiPropertyOptional({
    format: 'uuid',
    description: 'Saved membership method; omit for legacy hosted checkout',
  })
  @IsOptional()
  @IsUUID()
  paymentMethodId?: string;

  @ApiPropertyOptional({
    format: 'uuid',
    description: 'Required for saved-method checkout; preserve across retries',
  })
  @IsOptional()
  @IsUUID()
  requestId?: string;

  @ApiPropertyOptional({
    description: 'Required for saved-method recurring billing',
  })
  @IsOptional()
  @Equals(true)
  acceptRecurringBilling?: true;

  @ApiProperty({ enum: MembershipPlanCode })
  @IsEnum(MembershipPlanCode)
  planCode: MembershipPlanCode;

  @ApiProperty({ enum: BillingInterval })
  @IsEnum(BillingInterval)
  interval: BillingInterval;
  @ApiPropertyOptional({
    default: false,
    description: 'Use the 14-day membership offer',
  })
  @IsOptional()
  @IsBoolean()
  startTrial?: boolean;

  @ApiPropertyOptional({ example: 'BIENVENIDA10', nullable: true })
  @IsOptional()
  @IsString()
  @MaxLength(64)
  promotionCode?: string | null;
}
