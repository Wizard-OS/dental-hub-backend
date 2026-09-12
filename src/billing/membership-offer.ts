import { BadRequestException } from '@nestjs/common';
import { getEnv } from '../config/env';
import { BillingInterval } from './interfaces/billing-interval.enum';

export const TRIAL_DAYS = 14;
export const PROMOTION_CODE = 'BIENVENIDA10';

export function membershipQuote(
  interval: BillingInterval,
  promotionCode?: string | null,
  withTrial = true,
) {
  const code = promotionCode?.trim().toUpperCase() || null;
  if (!Object.values(BillingInterval).includes(interval)) {
    throw new BadRequestException('Invalid billing interval');
  }
  if (
    code &&
    (code !== PROMOTION_CODE || interval !== BillingInterval.yearly)
  ) {
    throw new BadRequestException('Promotion is not valid for this plan');
  }
  const subtotal = interval === BillingInterval.yearly ? 10000 : 1000;
  const discount = code ? 1000 : 0;
  return {
    planCode: 'premium' as const,
    name: 'DentalHub Premium',
    interval,
    currency: 'USD' as const,
    amountUnit: 'minor' as const,
    subtotal,
    discount,
    promotionCode: code,
    firstCharge: subtotal - discount,
    totalToday: withTrial ? 0 : subtotal - discount,
    renewalAmount: subtotal,
    monthlyEquivalent: interval === BillingInterval.yearly ? 833 : 1000,
    savingsPercent: interval === BillingInterval.yearly ? 17 : 0,
    trialDays: withTrial ? TRIAL_DAYS : 0,
    reminderDaysBeforeEnd: withTrial ? 2 : 0,
    autoRenew: true,
  };
}

export type MembershipQuote = ReturnType<typeof membershipQuote>;

export function offerPlanId(
  interval: BillingInterval,
  promotionCode?: string | null,
) {
  const quote = membershipQuote(interval, promotionCode);
  return getEnv(
    quote.promotionCode
      ? 'PAYPAL_PREMIUM_YEARLY_WELCOME_TRIAL_PLAN_ID'
      : interval === BillingInterval.yearly
        ? 'PAYPAL_PREMIUM_YEARLY_TRIAL_PLAN_ID'
        : 'PAYPAL_PREMIUM_MONTHLY_TRIAL_PLAN_ID',
  );
}
