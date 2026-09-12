import { INestApplication, ValidationPipe } from '@nestjs/common';
import { Test } from '@nestjs/testing';
import { DataSource } from 'typeorm';
import request from 'supertest';
import { randomUUID } from 'crypto';
import { AppModule } from '../src/app.module';
import {
  PayPalVaultProvider,
  VaultOrder,
  VaultResource,
} from '../src/billing/vault/paypal-vault.provider';
import { MembershipEmailProvider } from '../src/billing/notifications/membership-email.provider';
import { MembershipRemindersService } from '../src/billing/notifications/membership-reminders.service';
import { MembershipRenewalsService } from '../src/billing/vault/membership-renewals.service';
import { ClinicSubscription } from '../src/membership/entities/clinic-subscription.entity';
import { MembershipCharge } from '../src/billing/entities/membership-charge.entity';
import { SubscriptionStatus } from '../src/membership/interfaces/subscription-status.enum';
import { MembershipPaymentMethod } from '../src/billing/entities/membership-payment-method.entity';

class FakeVault {
  configured = true;
  setupConfigured = true;
  setups = new Map<string, VaultResource>();
  tokens = new Map<string, VaultResource>();
  orders = new Map<string, VaultOrder>();
  setupsByKey = new Map<string, VaultResource>();
  tokensByKey = new Map<string, VaultResource>();
  ordersByKey = new Map<string, VaultOrder>();
  captureCalls = 0;
  createCalls = 0;
  failCaptureOnce = false;
  createSetup = jest.fn(
    async (
      clinicId: string,
      type: string,
      key: string,
      customerId?: string,
    ) => {
      if (this.setupsByKey.has(key)) return this.setupsByKey.get(key)!;
      const result: VaultResource = {
        id: `SETUP${this.setups.size}`,
        status: 'CREATED',
        customer: {
          id: customerId ?? `C${clinicId}`,
          merchant_customer_id: clinicId,
        },
        payment_source:
          type === 'card'
            ? {
                card: {
                  brand: 'MASTERCARD',
                  last_digits: '4242',
                  expiry: '2035-08',
                },
              }
            : { paypal: { email_address: 'owner@example.com' } },
      };
      this.setups.set(result.id, result);
      this.setupsByKey.set(key, result);
      return result;
    },
  );
  getSetup = async (id: string) => this.setups.get(id)!;
  exchangeSetup = jest.fn(async (id: string, key: string) => {
    if (this.tokensByKey.has(key)) return this.tokensByKey.get(key)!;
    const setup = this.setups.get(id)!;
    const result = { ...setup, id: `TOKEN${this.tokens.size}` };
    this.tokens.set(result.id, result);
    this.tokensByKey.set(key, result);
    return result;
  });
  getToken = async (id: string) => {
    const token = this.tokens.get(id);
    if (!token) throw new Error('Token revoked');
    return token;
  };
  deleteToken = jest.fn(async (id: string) => {
    this.tokens.delete(id);
  });
  createOrder = jest.fn(async (input: { chargeId: string; amount: number }) => {
    if (this.ordersByKey.has(input.chargeId))
      return structuredClone(this.ordersByKey.get(input.chargeId)!);
    this.createCalls += 1;
    const order: VaultOrder = {
      id: `ORDER${this.orders.size}`,
      status: 'APPROVED',
      purchase_units: [
        {
          custom_id: input.chargeId,
          invoice_id: input.chargeId,
          amount: {
            currency_code: 'USD',
            value: (input.amount / 100).toFixed(2),
          },
        },
      ],
    };
    this.orders.set(order.id, order);
    this.ordersByKey.set(input.chargeId, order);
    return structuredClone(order);
  });
  getOrder = async (id: string) => structuredClone(this.orders.get(id)!);
  captureOrder = jest.fn(async (id: string) => {
    const order = this.orders.get(id)!;
    if (order.status !== 'COMPLETED') {
      this.captureCalls += 1;
      order.status = 'COMPLETED';
      order.purchase_units![0].payments = {
        captures: [
          {
            id: `CAP${id}`,
            status: 'COMPLETED',
            amount: order.purchase_units![0].amount!,
          },
        ],
      };
    }
    if (this.failCaptureOnce) {
      this.failCaptureOnce = false;
      throw new Error('Connection lost after capture');
    }
    return structuredClone(order);
  });
}

describe('Membership screens: saved methods, reminders and recurring billing (isolated PostgreSQL)', () => {
  let app: INestApplication;
  let db: DataSource;
  let vault: FakeVault;
  let token: string;
  let clinicId: string;
  let otherClinicId: string;
  let cardId: string;
  let paypalId: string;
  let setupId: string;
  let payload: Record<string, unknown>;
  let renewals: MembershipRenewalsService;
  let reminders: MembershipRemindersService;
  const email = { configured: true, send: jest.fn(async () => 'EMAIL-1') };
  const auth = (
    method: 'get' | 'post' | 'patch' | 'delete',
    path: string,
    clinic = clinicId,
  ) =>
    request(app.getHttpServer())
      [method](path)
      .set('Authorization', `Bearer ${token}`)
      .set('x-clinic-id', clinic);

  beforeAll(async () => {
    vault = new FakeVault();
    const module = await Test.createTestingModule({ imports: [AppModule] })
      .overrideProvider(PayPalVaultProvider)
      .useValue(vault)
      .overrideProvider(MembershipEmailProvider)
      .useValue(email)
      .compile();
    app = module.createNestApplication();
    app.useGlobalPipes(
      new ValidationPipe({ whitelist: true, forbidNonWhitelisted: true }),
    );
    await app.init();
    await app.listen(0);
    db = app.get(DataSource);
    renewals = app.get(MembershipRenewalsService);
    reminders = app.get(MembershipRemindersService);
    const owner = await request(app.getHttpServer())
      .post('/auth/register')
      .send({
        email: `billing-${randomUUID()}@example.com`,
        password: 'Abc123',
        firstName: 'Billing',
        lastName: 'Owner',
      })
      .expect(201);
    token = owner.body.token;
    const clinic = await request(app.getHttpServer())
      .post('/clinics')
      .set('Authorization', `Bearer ${token}`)
      .send({ name: 'Membership E2E', email: 'billing@example.com' })
      .expect(201);
    clinicId = clinic.body.id;
    const other = await request(app.getHttpServer())
      .post('/clinics')
      .set('Authorization', `Bearer ${token}`)
      .send({ name: 'Other clinic' })
      .expect(201);
    otherClinicId = other.body.id;
  });
  afterAll(async () => {
    await app?.close();
  });

  it('requires authentication and rejects card numbers at the API boundary', async () => {
    await request(app.getHttpServer())
      .get('/membership/payment-methods')
      .expect(401);
    await auth('post', '/membership/payment-methods/setup')
      .send({
        type: 'card',
        requestId: randomUUID(),
        number: '4242424242424242',
      })
      .expect(400);
  });
  it('requires verified setup approval and isolates it by clinic', async () => {
    const created = await auth('post', '/membership/payment-methods/setup')
      .send({ type: 'card', requestId: randomUUID() })
      .expect(201);
    setupId = created.body.setupSessionId;
    await auth(
      'post',
      `/membership/payment-methods/setup/${setupId}/confirm`,
    ).expect(400);
    await auth(
      'post',
      `/membership/payment-methods/setup/${setupId}/confirm`,
      otherClinicId,
    ).expect(404);
    vault.setups.get(created.body.setupTokenId)!.status = 'APPROVED';
    const completed = await auth(
      'post',
      `/membership/payment-methods/setup/${setupId}/confirm`,
    ).expect(201);
    cardId = completed.body.id;
    expect(completed.body).toMatchObject({
      brand: 'MASTERCARD',
      last4: '4242',
      expiry: '2035-08',
    });
    expect(completed.body).not.toHaveProperty('providerTokenId');
    const replay = await auth(
      'post',
      `/membership/payment-methods/setup/${setupId}/confirm`,
    ).expect(201);
    expect(replay.body.id).toBe(cardId);
    expect(vault.exchangeSetup).toHaveBeenCalledTimes(1);
  });
  it('adds PayPal, masks the email and selects exactly one default under concurrent requests', async () => {
    const created = await auth('post', '/membership/payment-methods/setup')
      .send({ type: 'paypal', requestId: randomUUID() })
      .expect(201);
    vault.setups.get(created.body.setupTokenId)!.status = 'APPROVED';
    const completed = await auth(
      'post',
      `/membership/payment-methods/setup/${created.body.setupSessionId}/confirm`,
    ).expect(201);
    paypalId = completed.body.id;
    expect(completed.body.maskedEmail).toBe('own***@example.com');
    await Promise.all(
      [cardId, paypalId].map((paymentMethodId) =>
        auth('patch', '/membership/payment-methods/default')
          .send({ paymentMethodId })
          .expect(200),
      ),
    );
    const list = await auth('get', '/membership/payment-methods').expect(200);
    expect(list.body.methods.filter((m) => m.isDefault)).toHaveLength(1);
    expect(list.body.methods).toHaveLength(2);
    expect(JSON.stringify(list.body)).not.toContain('TOKEN');
    await auth('patch', '/membership/payment-methods/default', otherClinicId)
      .send({ paymentMethodId: cardId })
      .expect(404);
  });
  it('starts once under concurrency, requires consent and snapshots the discounted offer', async () => {
    payload = {
      interval: 'yearly',
      promotionCode: 'BIENVENIDA10',
      paymentMethodId: cardId,
      requestId: randomUUID(),
      acceptRecurringBilling: true,
    };
    await auth('post', '/membership/start')
      .send({ ...payload, acceptRecurringBilling: false })
      .expect(400);
    const [first, repeated] = await Promise.all([
      auth('post', '/membership/start').send(payload).expect(201),
      auth('post', '/membership/start').send(payload).expect(201),
    ]);
    expect(first.body.membership.billing.providerSubscriptionId).toBe(
      repeated.body.membership.billing.providerSubscriptionId,
    );
    expect(first.body.membership).toMatchObject({
      status: 'trialing',
      checkout: { totalToday: 0, firstCharge: 9000, renewalAmount: 10000 },
      billing: { paymentMethod: { id: cardId } },
    });
    const checkoutAlias = await auth('post', '/billing/checkout')
      .send({ ...payload, planCode: 'premium' })
      .expect(201);
    expect(checkoutAlias.body.membership.billing.providerSubscriptionId).toBe(
      first.body.membership.billing.providerSubscriptionId,
    );
    const methods = await auth('get', '/membership/payment-methods').expect(
      200,
    );
    expect(methods.body.methods.find((m) => m.id === cardId).isDefault).toBe(
      true,
    );
    expect(vault.createOrder).not.toHaveBeenCalled();
    await auth('post', '/membership/start')
      .send({ ...payload, requestId: randomUUID() })
      .expect(409);
    await auth('delete', `/membership/payment-methods/${cardId}`).expect(409);
  });
  it('sends the day-12 reminder once, with durable state', async () => {
    const repo = db.getRepository(ClinicSubscription);
    await repo.update(
      { clinicId },
      {
        reminderDueAt: new Date(Date.now() - 1000),
        reminderNextAttemptAt: new Date(Date.now() - 1000),
      },
    );
    email.send.mockRejectedValueOnce(new Error('Temporary email failure'));
    await reminders.processDue();
    expect((await repo.findOneByOrFail({ clinicId })).reminderError).toBe(
      'EMAIL_DELIVERY_FAILED',
    );
    await reminders.processClinic(clinicId);
    expect(email.send).toHaveBeenCalledTimes(1);
    await repo.update(
      { clinicId },
      { reminderNextAttemptAt: new Date(Date.now() - 1000) },
    );
    await Promise.all([
      reminders.processClinic(clinicId),
      reminders.processClinic(clinicId),
    ]);
    expect(email.send).toHaveBeenCalledTimes(2);
    expect(email.send.mock.calls[0][1]).toMatchObject({
      to: 'billing@example.com',
      text: expect.stringContaining('US$90.00'),
    });
    expect(
      (await repo.findOneByOrFail({ clinicId })).reminderSentAt,
    ).toBeInstanceOf(Date);
  });
  it('charges 90 dollars on day 14 and recovers a lost capture response without a second charge', async () => {
    const now = new Date(Date.now() - 1000);
    await db.getRepository(ClinicSubscription).update(
      { clinicId },
      {
        trialEndsAt: now,
        nextChargeAt: now,
        billingAnchorAt: now,
        currentPeriodEnd: now,
      },
    );
    vault.failCaptureOnce = true;
    await renewals.processClinic(clinicId);
    let charges = await db.getRepository(MembershipCharge).findBy({ clinicId });
    expect(charges).toHaveLength(1);
    expect(charges[0].amount).toBe(9000);
    expect(charges[0].providerOrderId).toBeTruthy();
    await db
      .getRepository(MembershipCharge)
      .update(charges[0].id, { nextAttemptAt: new Date(Date.now() - 1000) });
    await Promise.all([
      renewals.processClinic(clinicId),
      renewals.processClinic(clinicId),
    ]);
    charges = await db.getRepository(MembershipCharge).findBy({ clinicId });
    expect(charges[0].status).toBe('paid');
    expect(vault.createCalls).toBe(1);
    expect(vault.captureCalls).toBe(1);
    const sub = await db
      .getRepository(ClinicSubscription)
      .findOneByOrFail({ clinicId });
    expect(sub.status).toBe('active');
    expect(sub.paidCycles).toBe(1);
    const restored = await auth('post', '/membership/restore').expect(201);
    expect(restored.body.status).toBe('active');
    expect(vault.captureCalls).toBe(1);
  });
  it('renews at full price and lets the clinic change its saved method', async () => {
    await auth('patch', '/membership/payment-methods/default')
      .send({ paymentMethodId: paypalId })
      .expect(200);
    await db
      .getRepository(ClinicSubscription)
      .update({ clinicId }, { nextChargeAt: new Date(Date.now() - 1000) });
    await renewals.processDue();
    const charges = await db
      .getRepository(MembershipCharge)
      .find({ where: { clinicId }, order: { cycle: 'ASC' } });
    expect(charges.map((c) => c.amount)).toEqual([9000, 10000]);
    expect(charges[1].status).toBe('paid');
    const list = await auth('get', '/membership/charges').expect(200);
    expect(list.body).toHaveLength(2);
    await auth(
      'post',
      `/membership/charges/${charges[1].id}/reconcile`,
      otherClinicId,
    )
      .send({ providerOrderId: charges[1].providerOrderId })
      .expect(404);
  });
  it('rejects an unrelated provider order during reconciliation', async () => {
    const charge = await db
      .getRepository(MembershipCharge)
      .findOneByOrFail({ clinicId, cycle: 1 });
    vault.orders.set('UNRELATED', {
      id: 'UNRELATED',
      status: 'COMPLETED',
      purchase_units: [
        {
          custom_id: randomUUID(),
          invoice_id: charge.id,
          amount: { value: '100.00', currency_code: 'USD' },
        },
      ],
    });
    await auth('post', `/membership/charges/${charge.id}/reconcile`)
      .send({ providerOrderId: 'UNRELATED' })
      .expect(400);
  });
  it('cancels, suppresses renewals, removes the token and refuses a second trial', async () => {
    await auth('post', '/membership/cancel').expect(201);
    const calls = vault.captureCalls;
    await renewals.processClinic(clinicId);
    expect(vault.captureCalls).toBe(calls);
    await auth('delete', `/membership/payment-methods/${paypalId}`).expect(200);
    await auth('delete', `/membership/payment-methods/${paypalId}`).expect(200);
    expect(vault.deleteToken).toHaveBeenCalledTimes(1);
    await auth('post', '/membership/start')
      .send({ ...payload, requestId: randomUUID(), startTrial: true })
      .expect(409);
    const record = await db
      .getRepository(MembershipPaymentMethod)
      .findOneByOrFail({ id: paypalId });
    expect(record.deletedAt).toBeTruthy();
  });
});
