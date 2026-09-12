import { billingPeriodEnd } from './membership-renewals.service';
import {
  methodExpired,
  maskedEmail,
} from './membership-payment-methods.service';
import { BillingInterval } from '../interfaces/billing-interval.enum';
import { membershipQuote } from '../membership-offer';

describe('Membership renewal boundaries', () => {
  it('clamps January 31 to February, then returns to March 31 without drift', () => {
    const anchor = new Date('2027-01-31T12:34:56Z');
    expect(
      billingPeriodEnd(anchor, BillingInterval.monthly, 1).toISOString(),
    ).toBe('2027-02-28T12:34:56.000Z');
    expect(
      billingPeriodEnd(anchor, BillingInterval.monthly, 2).toISOString(),
    ).toBe('2027-03-31T12:34:56.000Z');
  });
  it('keeps leap-day annual anchors and UTC time', () => {
    const anchor = new Date('2028-02-29T23:30:00Z');
    expect(
      billingPeriodEnd(anchor, BillingInterval.yearly, 1).toISOString(),
    ).toBe('2029-02-28T23:30:00.000Z');
    expect(
      billingPeriodEnd(anchor, BillingInterval.yearly, 4).toISOString(),
    ).toBe('2032-02-29T23:30:00.000Z');
  });
  it('keeps cards valid through the end of their expiry month', () => {
    const card = { type: 'card' as const, expiry: '2028-08' };
    expect(methodExpired(card, new Date('2028-08-31T23:59:59Z'))).toBe(false);
    expect(methodExpired(card, new Date('2028-09-01T00:00:00Z'))).toBe(true);
    expect(methodExpired({ ...card, expiry: '2028-13' })).toBe(true);
  });
  it('masks wallet addresses and quotes returning clinics without a second free trial', () => {
    expect(maskedEmail('owner@example.com')).toBe('own***@example.com');
    expect(maskedEmail(undefined)).toBeNull();
    expect(membershipQuote(BillingInterval.yearly, null, false)).toMatchObject({
      totalToday: 10000,
      trialDays: 0,
      reminderDaysBeforeEnd: 0,
    });
  });
});
