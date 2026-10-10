import { INestApplication } from '@nestjs/common';
import { Test, TestingModule } from '@nestjs/testing';

import request from 'supertest';
import { App } from 'supertest/types';

import { AppModule } from '../src/app.module';

describe('Messaging, reminders, and expenses (e2e)', () => {
  let app: INestApplication<App>;
  let adminToken: string;
  let clinicMainId: string;

  let patientAnaId: string;
  let appointmentId: string;
  let templateId: string;
  let reminderId: string;
  let outboundMessageId: string;

  beforeAll(async () => {
    const moduleFixture: TestingModule = await Test.createTestingModule({
      imports: [AppModule],
    }).compile();

    app = moduleFixture.createNestApplication();
    await app.init();

    const seedResponse = await request(app.getHttpServer())
      .get('/seed')
      .expect(200);

    clinicMainId = seedResponse.body.clinicIds['clinic-main'];

    const loginResponse = await request(app.getHttpServer())
      .post('/auth/login')
      .send({
        email: 'test1@google.com',
        password: 'Abc123',
      })
      .expect(201);

    adminToken = loginResponse.body.token;

    const patientAna = await request(app.getHttpServer())
      .get('/patients/ana.perez@example.com')
      .set('Authorization', `Bearer ${adminToken}`)
      .set('x-clinic-id', clinicMainId)
      .expect(200);

    patientAnaId = patientAna.body.id;

    const appointments = await request(app.getHttpServer())
      .get('/appointments')
      .set('Authorization', `Bearer ${adminToken}`)
      .set('x-clinic-id', clinicMainId)
      .expect(200);

    appointmentId = appointments.body[0].id;
  });

  afterAll(async () => {
    if (app) {
      await app.close();
    }
  });

  it('creates message template and reminder for appointment', async () => {
    const templateResponse = await request(app.getHttpServer())
      .post('/message-templates')
      .set('Authorization', `Bearer ${adminToken}`)
      .set('x-clinic-id', clinicMainId)
      .send({
        clinicId: clinicMainId,
        channel: 'email',
        name: 'Recordatorio 24h',
        body: 'Hola {{firstName}}, te recordamos tu cita para mañana.',
      })
      .expect(201);

    templateId = templateResponse.body.id;

    const reminderResponse = await request(app.getHttpServer())
      .post('/reminders')
      .set('Authorization', `Bearer ${adminToken}`)
      .set('x-clinic-id', clinicMainId)
      .send({
        appointmentId,
        templateId,
        channel: 'email',
        scheduledAt: new Date(Date.now() + 3_600_000).toISOString(),
      })
      .expect(201);

    reminderId = reminderResponse.body.id;

    expect(reminderResponse.body.status).toBe('scheduled');
  });

  it('creates outbound message and marks sent', async () => {
    const outboundResponse = await request(app.getHttpServer())
      .post('/outbound-messages')
      .set('Authorization', `Bearer ${adminToken}`)
      .set('x-clinic-id', clinicMainId)
      .send({
        clinicId: clinicMainId,
        patientId: patientAnaId,
        appointmentId,
        templateId,
        channel: 'email',
        payloadJson: {
          firstName: 'Ana',
          appointmentDate: '2026-03-10',
        },
      })
      .expect(201);

    outboundMessageId = outboundResponse.body.id;

    const updated = await request(app.getHttpServer())
      .patch(`/outbound-messages/${outboundMessageId}`)
      .set('Authorization', `Bearer ${adminToken}`)
      .set('x-clinic-id', clinicMainId)
      .send({
        status: 'sent',
        providerMessageId: 'provider-msg-123',
      })
      .expect(200);

    expect(updated.body.status).toBe('sent');
    expect(updated.body.providerMessageId).toBe('provider-msg-123');
  });

  it('creates expense and returns totals + dashboard summary', async () => {
    await request(app.getHttpServer())
      .post('/expenses')
      .set('Authorization', `Bearer ${adminToken}`)
      .set('x-clinic-id', clinicMainId)
      .send({
        clinicId: clinicMainId,
        category: 'supplies',
        amount: '35.50',
        spentAt: new Date().toISOString(),
        notes: 'Guantes y mascarillas',
      })
      .expect(201);

    const totals = await request(app.getHttpServer())
      .get('/expenses/totals')
      .set('Authorization', `Bearer ${adminToken}`)
      .set('x-clinic-id', clinicMainId)
      .expect(200);

    expect(Number(totals.text)).toBeGreaterThan(0);

    const dashboard = await request(app.getHttpServer())
      .get('/common/dashboard')
      .set('Authorization', `Bearer ${adminToken}`)
      .set('x-clinic-id', clinicMainId)
      .expect(200);

    expect(Number(dashboard.body.financial.expenseTotal)).toBeGreaterThan(0);
    expect(dashboard.body.operations.reminders).toBeGreaterThanOrEqual(1);
  });

  it('enforces clinic scope for reminders', async () => {
    await request(app.getHttpServer())
      .patch(`/reminders/${reminderId}`)
      .set('Authorization', `Bearer ${adminToken}`)
      .set('x-clinic-id', '00000000-0000-0000-0000-000000000000')
      .send({
        status: 'sent',
      })
      .expect(401);
  });
});
