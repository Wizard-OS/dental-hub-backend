import { INestApplication } from '@nestjs/common';
import { Test, TestingModule } from '@nestjs/testing';
import request from 'supertest';
import { App } from 'supertest/types';

import { AppModule } from '../src/app.module';

describe('Phase 1 Flow (e2e)', () => {
  let app: INestApplication<App>;
  let adminToken: string;
  let adminUserId: string;
  let clinicId: string;
  let membershipId: string;
  let patientId: string;
  let appointmentTypeId: string;
  let invoiceId: string;

  beforeAll(async () => {
    const moduleFixture: TestingModule = await Test.createTestingModule({
      imports: [AppModule],
    }).compile();

    app = moduleFixture.createNestApplication();
    await app.init();

    await request(app.getHttpServer()).get('/seed').expect(200);

    const loginResponse = await request(app.getHttpServer())
      .post('/auth/login')
      .send({
        email: 'test1@google.com',
        password: 'Abc123',
      })
      .expect(201);

    adminToken = loginResponse.body.token;
    adminUserId = loginResponse.body.id;
  });

  afterAll(async () => {
    if (app) {
      await app.close();
    }
  });

  it('creates clinic with owner membership', async () => {
    const clinicResponse = await request(app.getHttpServer())
      .post('/clinics')
      .set('Authorization', `Bearer ${adminToken}`)
      .send({
        name: 'Dental Hub Clinic',
        timezone: 'America/Montevideo',
        currency: 'USD',
      })
      .expect(201);

    clinicId = clinicResponse.body.id;

    const membershipsResponse = await request(app.getHttpServer())
      .get('/clinic-memberships')
      .set('Authorization', `Bearer ${adminToken}`)
      .set('x-clinic-id', clinicId)
      .expect(200);

    const ownerMembership = membershipsResponse.body.find(
      (membership: { userId: string; role: string }) =>
        membership.userId === adminUserId && membership.role === 'owner',
    );

    expect(ownerMembership).toBeDefined();
    membershipId = ownerMembership.id;
  });

  it('creates patient, appointment type and appointment in clinic scope', async () => {
    const patientResponse = await request(app.getHttpServer())
      .post('/patients/create')
      .set('Authorization', `Bearer ${adminToken}`)
      .set('x-clinic-id', clinicId)
      .send({
        clinicId,
        email: `patient_${Date.now()}@example.com`,
        firstName: 'Ana',
        lastName: 'Perez',
        birthDate: '1993-08-20',
        gender: 'Female',
      })
      .expect(201);

    patientId = patientResponse.body.id;

    const typeResponse = await request(app.getHttpServer())
      .post('/appointments/types')
      .set('Authorization', `Bearer ${adminToken}`)
      .set('x-clinic-id', clinicId)
      .send({
        clinicId,
        name: 'Consulta General',
        durationMin: 30,
        defaultPrice: '60.00',
      })
      .expect(201);

    appointmentTypeId = typeResponse.body.id;

    const startAt = new Date(Date.now() + 3600 * 1000);
    const endAt = new Date(startAt.getTime() + 30 * 60000);

    await request(app.getHttpServer())
      .post('/appointments')
      .set('Authorization', `Bearer ${adminToken}`)
      .set('x-clinic-id', clinicId)
      .send({
        clinicId,
        patientId,
        appointmentTypeId,
        professionalMembershipId: membershipId,
        description: 'Control inicial',
        startTime: startAt.toISOString(),
        endTime: endAt.toISOString(),
      })
      .expect(201);
  });

  it('handles partial payment and invoice status updates', async () => {
    const invoiceResponse = await request(app.getHttpServer())
      .post('/invoices')
      .set('Authorization', `Bearer ${adminToken}`)
      .set('x-clinic-id', clinicId)
      .send({
        clinicId,
        patientId,
        number: `INV-${Date.now()}`,
        status: 'pending',
        subtotal: '100.00',
        discount: '0.00',
        tax: '0.00',
        totalAmount: '100.00',
      })
      .expect(201);

    invoiceId = invoiceResponse.body.id;

    await request(app.getHttpServer())
      .post('/payments')
      .set('Authorization', `Bearer ${adminToken}`)
      .set('x-clinic-id', clinicId)
      .send({
        invoiceId,
        amount: '40.00',
        method: 'cash',
        paidAt: new Date().toISOString(),
        receivedByMembershipId: membershipId,
      })
      .expect(201);

    const invoiceAfterPayment = await request(app.getHttpServer())
      .get(`/invoices/${invoiceId}`)
      .set('Authorization', `Bearer ${adminToken}`)
      .set('x-clinic-id', clinicId)
      .expect(200);

    expect(invoiceAfterPayment.body.status).toBe('partially_paid');
  });
});
