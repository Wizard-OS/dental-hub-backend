import { membershipQuote } from './membership-offer';
import { BillingInterval } from './interfaces/billing-interval.enum';
import { validate } from 'class-validator';
import {
  MembershipQuoteDto,
  ConfirmMembershipDto,
} from './dto/membership-quote.dto';

describe('Membership offer contracts', () => {
  it('quotes the annual screen without charging today', () => {
    expect(membershipQuote(BillingInterval.yearly)).toMatchObject({
      subtotal: 10000,
      firstCharge: 10000,
      totalToday: 0,
      renewalAmount: 10000,
      monthlyEquivalent: 833,
      savingsPercent: 17,
      trialDays: 14,
      currency: 'USD',
      amountUnit: 'minor',
    });
  });
  it('discounts only the first annual charge and normalizes the code', () => {
    expect(
      membershipQuote(BillingInterval.yearly, ' bienvenida10 '),
    ).toMatchObject({
      discount: 1000,
      firstCharge: 9000,
      totalToday: 0,
      renewalAmount: 10000,
      promotionCode: 'BIENVENIDA10',
    });
  });
  it('quotes monthly without annual savings', () => {
    expect(membershipQuote(BillingInterval.monthly)).toMatchObject({
      firstCharge: 1000,
      renewalAmount: 1000,
      savingsPercent: 0,
      discount: 0,
    });
  });
  it.each([null, undefined, ''])(
    'allows removal of the promotion: %s',
    (code) => {
      expect(membershipQuote(BillingInterval.yearly, code).firstCharge).toBe(
        10000,
      );
    },
  );
  it('rejects unknown, stacked and monthly promotion codes', () => {
    for (const code of ['OTHER', 'BIENVENIDA10,OTHER']) {
      expect(() => membershipQuote(BillingInterval.yearly, code)).toThrow();
    }
    expect(() =>
      membershipQuote(BillingInterval.monthly, 'BIENVENIDA10'),
    ).toThrow();
  });
  it('validates request types and subscription identifiers', async () => {
    expect(
      await validate(
        Object.assign(new MembershipQuoteDto(), { interval: 'weekly' }),
      ),
    ).not.toHaveLength(0);
    expect(
      await validate(
        Object.assign(new MembershipQuoteDto(), {
          interval: 'yearly',
          promotionCode: ['BIENVENIDA10'],
        }),
      ),
    ).not.toHaveLength(0);
    expect(
      await validate(
        Object.assign(new ConfirmMembershipDto(), {
          providerSubscriptionId: '../anything',
        }),
      ),
    ).not.toHaveLength(0);
  });
});
