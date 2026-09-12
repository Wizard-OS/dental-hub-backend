import {
  BadRequestException,
  ConflictException,
  Injectable,
  NotFoundException,
} from '@nestjs/common';
import { DataSource, EntityManager, IsNull } from 'typeorm';
import { MembershipPaymentMethod } from '../entities/membership-payment-method.entity';
import { MembershipSetupSession } from '../entities/membership-setup-session.entity';
import { ClinicSubscription } from '../../membership/entities/clinic-subscription.entity';
import { PayPalVaultProvider, VaultResource } from './paypal-vault.provider';
import { withBillingLock } from './billing-lock';
import { CreateMembershipPaymentMethodDto } from '../dto/membership-payment-method.dto';
import { PayPalRequestError } from '../providers/paypal-billing.provider';
import { SubscriptionStatus } from '../../membership/interfaces/subscription-status.enum';

export function methodSummary(method: MembershipPaymentMethod) {
  return {
    id: method.id,
    type: method.type,
    brand: method.brand,
    last4: method.last4,
    expiry: method.expiry,
    maskedEmail: method.maskedEmail,
  };
}
export function methodExpired(
  method: Pick<MembershipPaymentMethod, 'type' | 'expiry'>,
  at = new Date(),
) {
  if (method.type !== 'card') return false;
  if (!method.expiry || !/^\d{4}-(0[1-9]|1[0-2])$/.test(method.expiry))
    return true;
  const [year, month] = method.expiry.split('-').map(Number);
  return new Date(Date.UTC(year, month, 1)) <= at;
}
export function maskedEmail(value?: string) {
  if (!value || !value.includes('@')) return null;
  const [local, domain] = value.split('@');
  return `${local.slice(0, Math.min(3, Math.max(1, local.length - 1)))}***@${domain}`;
}

@Injectable()
export class MembershipPaymentMethodsService {
  constructor(
    private readonly db: DataSource,
    private readonly provider: PayPalVaultProvider,
  ) {}

  async list(clinicId: string) {
    const methods = await this.db.getRepository(MembershipPaymentMethod).find({
      where: { clinicId, deletedAt: IsNull() },
      order: { createdAt: 'ASC' },
    });
    return {
      methods: methods.map((m) => ({
        ...methodSummary(m),
        isDefault: m.isDefault,
        expired: methodExpired(m),
      })),
      selectionMode: 'saved_methods',
      provider: 'paypal',
      canAdd: this.provider.setupConfigured,
      canSelectSaved: true,
      requiresApproval: false,
      supportedTypes: ['card', 'paypal'],
    };
  }

  async createSetup(clinicId: string, dto: CreateMembershipPaymentMethodDto) {
    return withBillingLock(this.db, clinicId, async (manager) => {
      const repo = manager.getRepository(MembershipSetupSession);
      let session = await repo.findOneBy({
        clinicId,
        requestId: dto.requestId,
      });
      if (session && session.type !== dto.type)
        throw new ConflictException(
          'Request ID already used for another payment method type',
        );
      if (session && session.expiresAt <= new Date())
        throw new ConflictException('Setup expired; use a new request ID');
      if (!session)
        session = await repo.save(
          repo.create({
            clinicId,
            requestId: dto.requestId,
            type: dto.type,
            expiresAt: new Date(Date.now() + 2 * 3600000),
          }),
        );
      if (!session.providerSetupTokenId) {
        const previous = await manager
          .getRepository(MembershipPaymentMethod)
          .createQueryBuilder('m')
          .addSelect('m.providerCustomerId')
          .where('m.clinicId = :clinicId', { clinicId })
          .orderBy('m.createdAt', 'DESC')
          .getOne();
        const result = await this.provider.createSetup(
          clinicId,
          dto.type,
          session.id,
          previous?.providerCustomerId,
        );
        if (!result.id)
          throw new BadRequestException('PayPal did not return a setup token');
        session.providerSetupTokenId = result.id;
        session.approvalUrl =
          result.links?.find((l) => ['approve', 'payer-action'].includes(l.rel))
            ?.href ?? null;
        await repo.save(session);
      }
      return {
        setupSessionId: session.id,
        setupTokenId: session.providerSetupTokenId,
        approvalUrl: session.approvalUrl,
        status: session.status,
        type: session.type,
        expiresAt: session.expiresAt,
        cardEntry: session.type === 'card' ? 'paypal_card_fields' : null,
      };
    });
  }

  async completeSetup(clinicId: string, sessionId: string) {
    return withBillingLock(this.db, clinicId, async (manager) => {
      const sessions = manager.getRepository(MembershipSetupSession);
      const session = await sessions.findOneBy({ id: sessionId, clinicId });
      if (!session) throw new NotFoundException('Setup session not found');
      if (session.paymentMethodId)
        return methodSummary(
          await this.requireMethod(manager, clinicId, session.paymentMethodId),
        );
      if (session.expiresAt <= new Date() || !session.providerSetupTokenId)
        throw new BadRequestException(
          'Setup session expired or not initialized',
        );
      if (!session.approvedCustomerId) {
        const setup = await this.provider.getSetup(
          session.providerSetupTokenId,
        );
        if (
          setup.id !== session.providerSetupTokenId ||
          setup.status !== 'APPROVED' ||
          !setup.customer?.id
        )
          throw new BadRequestException('Payment method approval is required');
        if (
          setup.customer.merchant_customer_id &&
          setup.customer.merchant_customer_id !== clinicId
        )
          throw new BadRequestException('Setup customer mismatch');
        session.approvedCustomerId = setup.customer.id;
        session.status = 'approved';
        await sessions.save(session);
      }
      if (!session.providerPaymentTokenId) {
        const exchanged = await this.provider.exchangeSetup(
          session.providerSetupTokenId,
          session.id,
        );
        if (!exchanged.id)
          throw new BadRequestException(
            'PayPal did not return a payment token',
          );
        session.providerPaymentTokenId = exchanged.id;
        await sessions.save(session);
      }
      const token = await this.provider.getToken(
        session.providerPaymentTokenId,
      );
      if (
        !token.customer?.id ||
        token.customer.id !== session.approvedCustomerId ||
        token.id !== session.providerPaymentTokenId
      )
        throw new BadRequestException('Vault customer mismatch');
      const existing = await manager
        .getRepository(MembershipPaymentMethod)
        .findOneBy({ providerTokenId: token.id });
      if (existing && (existing.clinicId !== clinicId || existing.deletedAt))
        throw new ConflictException('Payment token already used');
      const metadata = this.metadata(token, session.type);
      const method =
        existing ??
        manager.getRepository(MembershipPaymentMethod).create({
          clinicId,
          providerTokenId: token.id,
          providerCustomerId: token.customer.id,
          ...metadata,
        });
      if (methodExpired(method))
        throw new BadRequestException('Card is expired');
      return manager.transaction(async (tx) => {
        if (!existing)
          method.isDefault = !(await tx
            .getRepository(MembershipPaymentMethod)
            .existsBy({ clinicId, isDefault: true, deletedAt: IsNull() }));
        const saved = await tx
          .getRepository(MembershipPaymentMethod)
          .save(method);
        session.paymentMethodId = saved.id;
        session.status = 'completed';
        await tx.getRepository(MembershipSetupSession).save(session);
        return methodSummary(saved);
      });
    });
  }

  async select(clinicId: string, id: string) {
    return withBillingLock(this.db, clinicId, async (manager) => {
      const method = await this.requireMethod(manager, clinicId, id);
      await this.verify(method);
      const sub = await manager
        .getRepository(ClinicSubscription)
        .findOneBy({ clinicId });
      if (
        sub?.billingMode === 'subscription' &&
        sub.providerSubscriptionId &&
        ![SubscriptionStatus.canceled, SubscriptionStatus.expired].includes(
          sub.status,
        )
      ) {
        throw new ConflictException(
          'This legacy subscription manages its payment source in PayPal',
        );
      }
      await manager.transaction(async (tx) => {
        await tx
          .getRepository(MembershipPaymentMethod)
          .update({ clinicId, isDefault: true }, { isDefault: false });
        await tx
          .getRepository(MembershipPaymentMethod)
          .update({ id, clinicId }, { isDefault: true });
        if (sub?.billingMode === 'vault') {
          sub.selectedPaymentMethodId = id;
          sub.paymentMethodSummary = methodSummary(method);
          await tx.getRepository(ClinicSubscription).save(sub);
        }
      });
      return { ...methodSummary(method), isDefault: true };
    });
  }

  async remove(clinicId: string, id: string) {
    return withBillingLock(this.db, clinicId, async (manager) => {
      const method = await manager
        .getRepository(MembershipPaymentMethod)
        .createQueryBuilder('m')
        .addSelect(['m.providerTokenId', 'm.providerCustomerId'])
        .where('m.id = :id AND m.clinicId = :clinicId', { id, clinicId })
        .getOne();
      if (!method) throw new NotFoundException('Payment method not found');
      if (method.deletedAt) return { deleted: true };
      const sub = await manager
        .getRepository(ClinicSubscription)
        .findOneBy({ clinicId });
      if (
        sub?.selectedPaymentMethodId === id &&
        ![SubscriptionStatus.canceled, SubscriptionStatus.expired].includes(
          sub.status,
        )
      )
        throw new ConflictException(
          'Select another method or cancel the membership before removing this method',
        );
      try {
        await this.provider.deleteToken(method.providerTokenId);
      } catch (error) {
        if (!(
          error instanceof PayPalRequestError && error.providerStatus === 404
        ))
          throw error;
      }
      method.deletedAt = new Date();
      method.isDefault = false;
      await manager.getRepository(MembershipPaymentMethod).save(method);
      return { deleted: true };
    });
  }

  async requireMethod(manager: EntityManager, clinicId: string, id: string) {
    const method = await manager
      .getRepository(MembershipPaymentMethod)
      .createQueryBuilder('m')
      .addSelect(['m.providerTokenId', 'm.providerCustomerId'])
      .where('m.id = :id AND m.clinicId = :clinicId AND m.deletedAt IS NULL', {
        id,
        clinicId,
      })
      .getOne();
    if (!method) throw new NotFoundException('Payment method not found');
    if (methodExpired(method)) throw new BadRequestException('Card is expired');
    return method;
  }
  async verify(method: MembershipPaymentMethod) {
    const token = await this.provider.getToken(method.providerTokenId);
    if (
      token.id !== method.providerTokenId ||
      token.customer?.id !== method.providerCustomerId
    )
      throw new BadRequestException('Payment token ownership mismatch');
    const metadata = this.metadata(token, method.type);
    if (methodExpired(metadata))
      throw new BadRequestException('Card is expired');
    Object.assign(method, metadata);
  }
  private metadata(token: VaultResource, type: 'card' | 'paypal') {
    const card = token.payment_source?.card;
    if (type === 'card' && (!card || !/^\d{4}$/.test(card.last_digits ?? '')))
      throw new BadRequestException('Verified card details missing');
    if (type === 'paypal' && !token.payment_source?.paypal)
      throw new BadRequestException('Verified PayPal wallet missing');
    return {
      type,
      brand: card?.brand ?? null,
      last4: card?.last_digits ?? null,
      expiry: card?.expiry ?? null,
      maskedEmail: maskedEmail(token.payment_source?.paypal?.email_address),
    };
  }
}
