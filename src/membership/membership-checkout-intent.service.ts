import { apiMessage } from '../common/i18n/api-message';
import {
  BadRequestException,
  ConflictException,
  Injectable,
} from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { createHash } from 'crypto';
import { Repository } from 'typeorm';

import { ClinicSubscription } from './entities/clinic-subscription.entity';
import { MembershipPlanCode } from './interfaces/membership-plan-code.enum';
import { SubscriptionStatus } from './interfaces/subscription-status.enum';
import type { MembershipQuote } from '../billing/membership-offer';

@Injectable()
export class MembershipCheckoutIntentService {
  constructor(
    @InjectRepository(ClinicSubscription)
    private readonly subscriptionRepository: Repository<ClinicSubscription>,
  ) {}

  async reserve(input: {
    clinicId: string;
    fingerprint: string;
    trialRequested: boolean;
    checkoutQuote?: MembershipQuote;
  }) {
    return this.subscriptionRepository.manager.transaction(async (manager) => {
      await manager.query(
        'SELECT pg_advisory_xact_lock(hashtextextended($1, 0))',
        [`membership-checkout:${input.clinicId}`],
      );

      const repository = manager.getRepository(ClinicSubscription);
      const subscription = await repository.findOneByOrFail({
        clinicId: input.clinicId,
      });

      if (subscription.providerCheckoutRequestId) {
        if (
          subscription.providerCheckoutFingerprint !== input.fingerprint ||
          subscription.providerSubscriptionId
        ) {
          throw new ConflictException(
            apiMessage(
              'api.messages.a_checkout_is_already_pending_retry_the_original_checkout_options',
            ),
          );
        }

        return {
          requestId: subscription.providerCheckoutRequestId,
          quote: subscription.checkoutQuote ?? undefined,
        };
      }

      if (
        (subscription.providerSubscriptionId &&
          ![SubscriptionStatus.canceled, SubscriptionStatus.expired].includes(
            subscription.status,
          )) ||
        subscription.planCode === MembershipPlanCode.premium
      ) {
        throw new BadRequestException(
          apiMessage(
            'api.messages.a_subscription_already_exists_confirm_restore_or_cancel_it_first',
          ),
        );
      }

      if (
        input.trialRequested &&
        (subscription.trialStartedAt ||
          subscription.licenseIssuedAt ||
          subscription.recurringConsentAt)
      ) {
        throw new BadRequestException(
          apiMessage('api.messages.the_clinic_has_already_used_its_trial'),
        );
      }

      const requestId = createHash('sha256')
        .update(
          JSON.stringify([
            input.clinicId,
            subscription.id,
            subscription.updatedAt,
            input.fingerprint,
          ]),
        )
        .digest('hex')
        .slice(0, 38);

      subscription.providerCheckoutRequestId = requestId;
      subscription.providerCheckoutFingerprint = input.fingerprint;
      subscription.checkoutQuote = input.checkoutQuote ?? null;
      subscription.billingMode = 'subscription';
      subscription.providerSubscriptionId = null;
      subscription.providerPlanId = null;
      subscription.providerCustomerId = null;
      subscription.providerStatus = 'CHECKOUT_PENDING';
      subscription.status = SubscriptionStatus.incomplete;
      subscription.changeReason = 'Hosted checkout reserved';
      await repository.save(subscription);

      return { requestId, quote: input.checkoutQuote };
    });
  }
}
