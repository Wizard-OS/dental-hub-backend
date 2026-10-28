import { HttpStatus, INestApplication } from '@nestjs/common';
import { Test, TestingModule } from '@nestjs/testing';
import request from 'supertest';
import { App } from 'supertest/types';
import { DataSource } from 'typeorm';

import { AppModule } from '../src/app.module';
import { readJsonString, readJsonValue } from './support/json-response';
import {
  configureTestApplication,
  seedTestDatabase,
} from './support/test-application';

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

    app = moduleFixture.createNestApplication({ bodyParser: false });
    configureTestApplication(app);
    await app.init();
    dataSource = app.get(DataSource);

    await seedTestDatabase(app);

    const suffix = Date.now();

    const owner = await request(app.getHttpServer())
      .post('/auth/register')
      .send({
        email: `membership_owner_${suffix}@example.com`,
        password: 'Long dental passphrase 123',
        firstName: 'Owner',
        lastName: 'Membership',
      })
      .expect(HttpStatus.CREATED);

    ownerToken = readJsonString(owner.body, 'token');

    const specialist = await request(app.getHttpServer())
      .post('/auth/register')
      .send({
        email: `membership_specialist_${suffix}@example.com`,
        password: 'Long dental passphrase 123',
        firstName: 'Specialist',
        lastName: 'Dental',
      })
      .expect(HttpStatus.CREATED);

    specialistToken = readJsonString(specialist.body, 'token');
    specialistUserId = readJsonString(specialist.body, 'id');

    const extraSpecialist = await request(app.getHttpServer())
      .post('/auth/register')
      .send({
        email: `membership_extra_specialist_${suffix}@example.com`,
        password: 'Long dental passphrase 123',
        firstName: 'Extra',
        lastName: 'Specialist',
      })
      .expect(HttpStatus.CREATED);

    extraSpecialistUserId = readJsonString(extraSpecialist.body, 'id');

    const clinic = await request(app.getHttpServer())
      .post('/clinics')
      .set('Authorization', `Bearer ${ownerToken}`)
      .send({
        name: `Membership Clinic ${suffix}`,
        timezone: 'America/Montevideo',
        currency: 'USD',
      })
      .expect(HttpStatus.CREATED);

    clinicId = readJsonString(clinic.body, 'id');
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
      .expect(HttpStatus.OK);

    expect(readJsonValue(current.body, 'plan')).toEqual(
      expect.objectContaining({ code: 'free' }),
    );
    expect(readJsonValue(current.body, 'limits')).toEqual(
      expect.objectContaining({
        professionalUsers: 1,
        totalUsers: 2,
        activePatients: null,
        messagingCreditsMonthlyIncluded: 100,
      }),
    );
    expect(readJsonValue(current.body, 'warnings')).not.toHaveProperty(
      'activePatients',
    );
    expect(readJsonValue(current.body, 'entitlements')).toEqual(
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
      .expect(HttpStatus.CREATED);

    specialistMembershipId = readJsonString(specialistMembership.body, 'id');

    await request(app.getHttpServer())
      .post('/clinic-memberships')
      .set('Authorization', `Bearer ${ownerToken}`)
      .set('x-clinic-id', clinicId)
      .send({
        clinicId,
        userId: extraSpecialistUserId,
        role: 'specialist',
      })
      .expect(HttpStatus.BAD_REQUEST);
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
        .expect(HttpStatus.CREATED);

      if (i === 0) archivedPatientId = readJsonString(patient.body, 'id');

      if (i === 1) storagePatientId = readJsonString(patient.body, 'id');
    }

    await request(app.getHttpServer())
      .delete(`/patients/${archivedPatientId}`)
      .set('Authorization', `Bearer ${ownerToken}`)
      .set('x-clinic-id', clinicId)
      .expect(HttpStatus.OK);

    await request(app.getHttpServer())
      .patch(`/patients/${archivedPatientId}/reactivate`)
      .set('Authorization', `Bearer ${ownerToken}`)
      .set('x-clinic-id', clinicId)
      .expect(HttpStatus.OK);

    const afterPatients = await request(app.getHttpServer())
      .get('/membership/current')
      .set('Authorization', `Bearer ${ownerToken}`)
      .set('x-clinic-id', clinicId)
      .expect(HttpStatus.OK);

    expect(
      readJsonValue(afterPatients.body, 'limits', 'activePatients'),
    ).toBeNull();
    expect(
      readJsonValue(afterPatients.body, 'usage', 'activePatients'),
    ).toBeGreaterThanOrEqual(55);
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
      .expect(HttpStatus.BAD_REQUEST);
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
      .expect(HttpStatus.OK);

    await request(app.getHttpServer())
      .post('/clinic-memberships')
      .set('Authorization', `Bearer ${ownerToken}`)
      .set('x-clinic-id', clinicId)
      .send({
        clinicId,
        userId: extraSpecialistUserId,
        role: 'specialist',
      })
      .expect(HttpStatus.CREATED);

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
      .expect(HttpStatus.CREATED);

    await request(app.getHttpServer())
      .post('/patient-assignments')
      .set('Authorization', `Bearer ${ownerToken}`)
      .set('x-clinic-id', clinicId)
      .send({
        patientId: readJsonString(patient.body, 'id'),
        professionalMembershipId: specialistMembershipId,
      })
      .expect(HttpStatus.CREATED);

    const patients = await request(app.getHttpServer())
      .get('/patients')
      .set('Authorization', `Bearer ${specialistToken}`)
      .set('x-clinic-id', clinicId)
      .expect(HttpStatus.OK);

    expect(patients.body).toEqual(
      expect.arrayContaining([
        expect.objectContaining({
          id: readJsonString(patient.body, 'id'),
          email: null,
          phone: null,
          address: null,
          emergencyContact: null,
        }),
      ]),
    );
  });
});
