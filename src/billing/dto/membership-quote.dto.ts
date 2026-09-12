import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';
import {
  IsEnum,
  IsOptional,
  IsString,
  MaxLength,
  Matches,
} from 'class-validator';
import { BillingInterval } from '../interfaces/billing-interval.enum';

export class MembershipQuoteDto {
  @ApiProperty({ enum: BillingInterval, example: 'yearly' })
  @IsEnum(BillingInterval)
  interval: BillingInterval;

  @ApiPropertyOptional({ example: 'BIENVENIDA10', nullable: true })
  @IsOptional()
  @IsString()
  @MaxLength(64)
  promotionCode?: string | null;
}

export class ConfirmMembershipDto {
  @ApiProperty({ example: 'I-ABC123DEF456' })
  @IsString()
  @Matches(/^(I-[A-Z0-9]+|V-[a-f0-9-]{36})$/)
  @MaxLength(64)
  providerSubscriptionId: string;
}
