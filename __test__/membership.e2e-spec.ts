import { INestApplication } from '@nestjs/common';
import { Test, TestingModule } from '@nestjs/testing';
import request from 'supertest';
import { App } from 'supertest/types';
import { DataSource } from 'typeorm';

import { AppModule } from '../src/app.module';

describe('Membership limits (e2e)', () => {
  let app: INestApplication<App>;
  let dataSource: DataSource;
  let ownerToken: string;
  let specialistToken: string;
  let specialistUserId: string;
  let extraSpecialistUserId: string;
  let clinicId: string;
  let specialistMembershipId: string;
  let archivedPatientId: string;
  let storagePatientId: string;

  beforeAll(async () => {
    const moduleFixture: TestingModule = await Test.createTestingModule({
      imports: [AppModule],
    }).compile();

    app = moduleFixture.createNestApplication();
    await app.init();
    dataSource = app.get(DataSource);

    await request(app.getHttpServer()).get('/seed').expect(200);

    const suffix = Date.now();

    const owner = await request(app.getHttpServer())
      .post('/auth/register')
      .send({
        email: `membership_owner_${suffix}@example.com`,
        password: 'Abc123',
        firstName: 'Owner',
        lastName: 'Membership',
      })
      .expect(201);

    ownerToken = owner.body.token;

    const specialist = await request(app.getHttpServer())
      .post('/auth/register')
      .send({
        email: `membership_specialist_${suffix}@example.com`,
        password: 'Abc123',
        firstName: 'Specialist',
        lastName: 'Dental',
      })
      .expect(201);

    specialistToken = specialist.body.token;
    specialistUserId = specialist.body.id;

    const extraSpecialist = await request(app.getHttpServer())
      .post('/auth/register')
      .send({
        email: `membership_extra_specialist_${suffix}@example.com`,
        password: 'Abc123',
        firstName: 'Extra',
        lastName: 'Specialist',
      })
      .expect(201);

    extraSpecialistUserId = extraSpecialist.body.id;

    const clinic = await request(app.getHttpServer())
      .post('/clinics')
      .set('Authorization', `Bearer ${ownerToken}`)
      .send({
        name: `Membership Clinic ${suffix}`,
        timezone: 'America/Montevideo',
        currency: 'USD',
      })
      .expect(201);

    clinicId = clinic.body.id;
  });

  afterAll(async () => {
    if (app) {
      await app.close();
    }
  });

  it('creates new clinics on the free plan and blocks extra users/professionals', async () => {
    const current = await request(app.getHttpServer())
      .get('/membership/current')
      .set('Authorization', `Bearer ${ownerToken}`)
      .set('x-clinic-id', clinicId)
      .expect(200);

    expect(current.body.plan).toEqual(
      expect.objectContaining({ code: 'free' }),
    );
    expect(current.body.limits).toEqual(
      expect.objectContaining({
        professionalUsers: 1,
        totalUsers: 2,
        activePatients: null,
        messagingCreditsMonthlyIncluded: 100,
      }),
    );
    expect(current.body.warnings).not.toHaveProperty('activePatients');
    expect(current.body.entitlements).toEqual(
      expect.objectContaining({
        patientPortal: false,
        googleCalendar: false,
        onlinePayments: false,
      }),
    );

    const specialistMembership = await request(app.getHttpServer())
      .post('/clinic-memberships')
      .set('Authorization', `Bearer ${ownerToken}`)
      .set('x-clinic-id', clinicId)
      .send({
        clinicId,
        userId: specialistUserId,
        role: 'specialist',
      })
      .expect(201);

    specialistMembershipId = specialistMembership.body.id;

    await request(app.getHttpServer())
      .post('/clinic-memberships')
      .set('Authorization', `Bearer ${ownerToken}`)
      .set('x-clinic-id', clinicId)
      .send({
        clinicId,
        userId: extraSpecialistUserId,
        role: 'specialist',
      })
      .expect(400);
  });

  it('allows multiple free patients and reactivates archived patients without a commercial patient limit', async () => {
    const suffix = Date.now();

    for (let i = 0; i < 55; i += 1) {
      const patient = await request(app.getHttpServer())
        .post('/patients/create')
        .set('Authorization', `Bearer ${ownerToken}`)
        .set('x-clinic-id', clinicId)
        .send({
          clinicId,
          email: `limit_patient_${suffix}_${i}@example.com`,
          firstName: `Limit${i}`,
          lastName: 'Patient',
          documentId: `LIMIT-${suffix}-${i}`,
          birthDate: '1990-01-01',
          gender: 'Other',
          phone: `+5988${suffix.toString().slice(-5)}${i
            .toString()
            .padStart(2, '0')}`,
        })
        .expect(201);

      if (i === 0) archivedPatientId = patient.body.id;

      if (i === 1) storagePatientId = patient.body.id;
    }

    await request(app.getHttpServer())
      .delete(`/patients/${archivedPatientId}`)
      .set('Authorization', `Bearer ${ownerToken}`)
      .set('x-clinic-id', clinicId)
      .expect(200);

    await request(app.getHttpServer())
      .patch(`/patients/${archivedPatientId}/reactivate`)
      .set('Authorization', `Bearer ${ownerToken}`)
      .set('x-clinic-id', clinicId)
      .expect(200);

    const afterPatients = await request(app.getHttpServer())
      .get('/membership/current')
      .set('Authorization', `Bearer ${ownerToken}`)
      .set('x-clinic-id', clinicId)
      .expect(200);

    expect(afterPatients.body.limits.activePatients).toBeNull();
    expect(afterPatients.body.usage.activePatients).toBeGreaterThanOrEqual(55);
  });

  it('blocks patient file uploads when the storage limit would be exceeded', async () => {
    await dataSource.query(
      `
        INSERT INTO patient_files (
          "patientId",
          "uploadedByMembershipId",
          type,
          "originalName",
          "storedName",
          path,
          url,
          "mimeType",
          size,
          "createdAt"
        )
        VALUES ($1, $2, 'pdf', 'near-limit.pdf', 'near-limit.pdf', '/tmp/near-limit.pdf', '/uploads/patient-files/near-limit.pdf', 'application/pdf', $3, now())
      `,
      [storagePatientId, specialistMembershipId, 512 * 1024 * 1024 - 5],
    );

    await request(app.getHttpServer())
      .post(`/patients/${storagePatientId}/files`)
      .set('Authorization', `Bearer ${ownerToken}`)
      .set('x-clinic-id', clinicId)
      .field('type', 'pdf')
      .attach('file', Buffer.from('%PDF-1.4 test'), {
        filename: 'blocked-storage.pdf',
        contentType: 'application/pdf',
      })
      .expect(400);
  });

  it('allows premium capacity and keeps specialist patient contact hidden', async () => {
    await request(app.getHttpServer())
      .patch('/membership/manual')
      .set('Authorization', `Bearer ${ownerToken}`)
      .set('x-clinic-id', clinicId)
      .send({
        planCode: 'premium',
        reason: 'E2E upgrade',
      })
      .expect(200);

    await request(app.getHttpServer())
      .post('/clinic-memberships')
      .set('Authorization', `Bearer ${ownerToken}`)
      .set('x-clinic-id', clinicId)
      .send({
        clinicId,
        userId: extraSpecialistUserId,
        role: 'specialist',
      })
      .expect(201);

    const patient = await request(app.getHttpServer())
      .post('/patients/create')
      .set('Authorization', `Bearer ${ownerToken}`)
      .set('x-clinic-id', clinicId)
      .send({
        clinicId,
        email: `specialist_patient_${Date.now()}@example.com`,
        firstName: 'Specialist',
        lastName: 'Visible',
        documentId: `SPECIALIST-${Date.now()}`,
        birthDate: '1990-01-01',
        gender: 'Other',
        phone: '+59891112222',
        address: 'Hidden address',
        emergencyContact: 'Hidden contact',
      })
      .expect(201);

    await request(app.getHttpServer())
      .post('/patient-assignments')
      .set('Authorization', `Bearer ${ownerToken}`)
      .set('x-clinic-id', clinicId)
      .send({
        patientId: patient.body.id,
        professionalMembershipId: specialistMembershipId,
      })
      .expect(201);

    const patients = await request(app.getHttpServer())
      .get('/patients')
      .set('Authorization', `Bearer ${specialistToken}`)
      .set('x-clinic-id', clinicId)
      .expect(200);

    expect(patients.body).toEqual(
      expect.arrayContaining([
        expect.objectContaining({
          id: patient.body.id,
          email: null,
          phone: null,
          address: null,
          emergencyContact: null,
        }),
      ]),
    );
  });
});
