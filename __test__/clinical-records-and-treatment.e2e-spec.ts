import { HttpStatus, INestApplication } from '@nestjs/common';
import { Test, TestingModule } from '@nestjs/testing';
import { getRepositoryToken } from '@nestjs/typeorm';
import request from 'supertest';
import { App } from 'supertest/types';
import { Repository } from 'typeorm';

import { AppModule } from '../src/app.module';
import { ClinicPermission } from '../src/auth/interfaces';
import { ClinicMembership } from '../src/clinic-memberships/entities/clinic-membership.entity';
import { ClinicMembershipRole } from '../src/clinic-memberships/interfaces/clinic-membership-role.enum';
import { PatientProfessionalAssignment } from '../src/patient-assignments/entities/patient-professional-assignment.entity';
import { readJsonArray, readJsonValue } from './support/json-response';
import { readJsonString } from './support/json-response';
import {
  configureTestApplication,
  seedTestDatabase,
} from './support/test-application';

describe('Clinical records and treatment (e2e)', () => {
  let app: INestApplication<App>;
  let adminToken: string;
  let adminUserId: string;
  let clinicMainId: string;
  let clinicEastId: string;

  let patientAnaId: string;
  let patientLuisId: string;

  let clinicalRecordAnaId: string;
  let clinicalRecordLuisId: string;
  let treatmentAnaId: string;
  let sessionAnaId: string;

  beforeAll(async () => {
    const moduleFixture: TestingModule = await Test.createTestingModule({
      imports: [AppModule],
    }).compile();

    app = moduleFixture.createNestApplication({ bodyParser: false });
    configureTestApplication(app);
    await app.init();

    const seedResponse = await seedTestDatabase(app);

    clinicMainId = readJsonString(
      seedResponse.body,
      'clinicIds',
      'clinic-main',
    );
    clinicEastId = readJsonString(
      seedResponse.body,
      'clinicIds',
      'clinic-east',
    );

    const loginResponse = await request(app.getHttpServer())
      .post('/auth/login')
      .send({
        email: 'test1@google.com',
        password: 'Abc123',
      })
      .expect(HttpStatus.CREATED);

    adminToken = readJsonString(loginResponse.body, 'token');
    adminUserId = readJsonString(loginResponse.body, 'id');

    const patientAna = await request(app.getHttpServer())
      .get('/patients/ana.perez@example.com')
      .set('Authorization', `Bearer ${adminToken}`)
      .set('x-clinic-id', clinicMainId)
      .expect(HttpStatus.OK);

    const patientLuis = await request(app.getHttpServer())
      .get('/patients/luis.mendez@example.com')
      .set('Authorization', `Bearer ${adminToken}`)
      .set('x-clinic-id', clinicMainId)
      .expect(HttpStatus.OK);

    patientAnaId = readJsonString(patientAna.body, 'id');
    patientLuisId = readJsonString(patientLuis.body, 'id');
  });

  afterAll(async () => {
    if (app) {
      await app.close();
    }
  });

  it('creates clinical records per patient and blocks duplicates', async () => {
    const recordAna = await request(app.getHttpServer())
      .post('/clinical-records')
      .set('Authorization', `Bearer ${adminToken}`)
      .set('x-clinic-id', clinicMainId)
      .send({
        patientId: patientAnaId,
        allergies: 'Penicillin',
        chronicDiseases: 'Hypertension',
      })
      .expect(HttpStatus.CREATED);

    clinicalRecordAnaId = readJsonString(recordAna.body, 'id');

    const recordLuis = await request(app.getHttpServer())
      .post('/clinical-records')
      .set('Authorization', `Bearer ${adminToken}`)
      .set('x-clinic-id', clinicMainId)
      .send({
        patientId: patientLuisId,
        allergies: 'None',
      })
      .expect(HttpStatus.CREATED);

    clinicalRecordLuisId = readJsonString(recordLuis.body, 'id');

    await request(app.getHttpServer())
      .post('/clinical-records')
      .set('Authorization', `Bearer ${adminToken}`)
      .set('x-clinic-id', clinicMainId)
      .send({
        patientId: patientAnaId,
      })
      .expect(HttpStatus.BAD_REQUEST);
  });

  it('blocks clinical notes on records outside clinic scope', async () => {
    await request(app.getHttpServer())
      .post('/clinical-notes')
      .set('Authorization', `Bearer ${adminToken}`)
      .set('x-clinic-id', clinicEastId)
      .send({
        clinicalRecordId: clinicalRecordAnaId,
        content: 'Nota fuera de alcance de clinica',
      })
      .expect(HttpStatus.UNAUTHORIZED);
  });

  it('creates treatment and valid treatment session for same patient', async () => {
    const treatment = await request(app.getHttpServer())
      .post('/treatments')
      .set('Authorization', `Bearer ${adminToken}`)
      .set('x-clinic-id', clinicMainId)
      .send({
        name: 'Ortodoncia inicial',
        patientId: patientAnaId,
        doctorId: adminUserId,
        description: 'Plan de tratamiento fase inicial',
        basePrice: '450.00',
      })
      .expect(HttpStatus.CREATED);

    treatmentAnaId = readJsonString(treatment.body, 'id');

    const session = await request(app.getHttpServer())
      .post('/treatment-sessions')
      .set('Authorization', `Bearer ${adminToken}`)
      .set('x-clinic-id', clinicMainId)
      .send({
        treatmentId: treatmentAnaId,
        clinicalRecordId: clinicalRecordAnaId,
        price: '150.00',
        performedAt: new Date().toISOString(),
      })
      .expect(HttpStatus.CREATED);

    sessionAnaId = readJsonString(session.body, 'id');
  });

  it('rejects treatment session when record and treatment belong to different patients', async () => {
    await request(app.getHttpServer())
      .post('/treatment-sessions')
      .set('Authorization', `Bearer ${adminToken}`)
      .set('x-clinic-id', clinicMainId)
      .send({
        treatmentId: treatmentAnaId,
        clinicalRecordId: clinicalRecordLuisId,
        price: '120.00',
        performedAt: new Date().toISOString(),
      })
      .expect(HttpStatus.BAD_REQUEST);
  });
  it('paginates all general collections and rejects invalid limits', async () => {
    for (const path of [
      'appointments',
      'invoices',
      'payments',
      'expenses',
      'clinical-records',
      'clinical-notes',
      'treatments',
      'treatment-sessions',
    ]) {
      const response = await request(app.getHttpServer())
        .get(`/${path}`)
        .query({ limit: 1, offset: 0 })
        .auth(adminToken, { type: 'bearer' })
        .set('x-clinic-id', clinicMainId)
        .expect(HttpStatus.OK);

      expect(readJsonArray(response.body, 'items').length).toBeLessThanOrEqual(
        1,
      );
      expect(response.body).toMatchObject({
        limit: 1,
        offset: 0,
        total: expect.any(Number) as unknown,
      });
      await request(app.getHttpServer())
        .get(`/${path}`)
        .query({ limit: 101 })
        .auth(adminToken, { type: 'bearer' })
        .set('x-clinic-id', clinicMainId)
        .expect(HttpStatus.BAD_REQUEST);
    }
    const records = await request(app.getHttpServer())
      .get('/clinical-records')
      .query({ limit: 1, offset: 1 })
      .auth(adminToken, { type: 'bearer' })
      .set('x-clinic-id', clinicMainId)
      .expect(HttpStatus.OK);

    expect(readJsonValue(records.body, 'total')).toBe(2);
    expect(readJsonArray(records.body, 'items')).toHaveLength(1);
  });

  it('enforces patient assignments, clinical permissions and authorized totals for treatment sessions', async () => {
    const registered = await request(app.getHttpServer())
      .post('/auth/register')
      .send({
        email: 'assigned@example.test',
        password: 'a long dental passphrase',
        firstName: 'Assigned',
        lastName: 'Specialist',
      })
      .expect(HttpStatus.CREATED);
    const token = readJsonString(registered.body, 'token');
    const memberships = app.get<Repository<ClinicMembership>>(
      getRepositoryToken(ClinicMembership),
    );
    const member = await memberships.save(
      memberships.create({
        clinicId: clinicMainId,
        userId: readJsonString(registered.body, 'id'),
        role: ClinicMembershipRole.specialist,
      }),
    );
    const list = () =>
      request(app.getHttpServer())
        .get('/treatment-sessions')
        .auth(token, { type: 'bearer' })
        .set('x-clinic-id', clinicMainId);
    const inaccessible = await list().expect(HttpStatus.OK);

    expect(inaccessible.body).toMatchObject({ items: [], total: 0 });
    await request(app.getHttpServer())
      .get(`/treatment-sessions/${sessionAnaId}`)
      .auth(token, { type: 'bearer' })
      .set('x-clinic-id', clinicMainId)
      .expect(HttpStatus.FORBIDDEN);
    const payload = {
      treatmentId: treatmentAnaId,
      clinicalRecordId: clinicalRecordAnaId,
      price: '12.00',
      performedAt: new Date().toISOString(),
    };

    await request(app.getHttpServer())
      .post('/treatment-sessions')
      .auth(token, { type: 'bearer' })
      .set('x-clinic-id', clinicMainId)
      .send(payload)
      .expect(HttpStatus.FORBIDDEN);
    const owner = await memberships.findOneByOrFail({
      clinicId: clinicMainId,
      userId: adminUserId,
    });
    const assignments = app.get<Repository<PatientProfessionalAssignment>>(
      getRepositoryToken(PatientProfessionalAssignment),
    );

    await assignments.save(
      assignments.create({
        clinicId: clinicMainId,
        patientId: patientAnaId,
        professionalMembershipId: member.id,
        assignedByMembershipId: owner.id,
      }),
    );
    const accessible = await list().expect(HttpStatus.OK);

    expect(accessible.body).toMatchObject({ total: 1 });
    for (const path of ['clinical-records', 'treatments']) {
      const response = await request(app.getHttpServer())
        .get(`/${path}`)
        .auth(token, { type: 'bearer' })
        .set('x-clinic-id', clinicMainId)
        .expect(HttpStatus.OK);

      expect(response.body).toMatchObject({ total: 1 });
    }
    const secondTreatment = await request(app.getHttpServer())
      .post('/treatments')
      .auth(adminToken, { type: 'bearer' })
      .set('x-clinic-id', clinicMainId)
      .send({
        name: 'Other patient treatment',
        patientId: patientLuisId,
        doctorId: adminUserId,
        basePrice: '10.00',
      })
      .expect(HttpStatus.CREATED);

    await request(app.getHttpServer())
      .patch(`/treatment-sessions/${sessionAnaId}`)
      .auth(token, { type: 'bearer' })
      .set('x-clinic-id', clinicMainId)
      .send({
        treatmentId: readJsonString(secondTreatment.body, 'id'),
        clinicalRecordId: clinicalRecordLuisId,
      })
      .expect(HttpStatus.FORBIDDEN);
    await memberships.update(member.id, {
      permissionsJson: { [ClinicPermission.manageClinical]: false },
    });
    await request(app.getHttpServer())
      .get(`/treatment-sessions/${sessionAnaId}`)
      .auth(token, { type: 'bearer' })
      .set('x-clinic-id', clinicMainId)
      .expect(HttpStatus.OK);
    await request(app.getHttpServer())
      .post('/treatment-sessions')
      .auth(token, { type: 'bearer' })
      .set('x-clinic-id', clinicMainId)
      .send(payload)
      .expect(HttpStatus.FORBIDDEN);
    await request(app.getHttpServer())
      .patch(`/treatment-sessions/${sessionAnaId}`)
      .auth(token, { type: 'bearer' })
      .set('x-clinic-id', clinicMainId)
      .send({ price: '1.00' })
      .expect(HttpStatus.FORBIDDEN);
    await request(app.getHttpServer())
      .delete(`/treatment-sessions/${sessionAnaId}`)
      .auth(token, { type: 'bearer' })
      .set('x-clinic-id', clinicMainId)
      .expect(HttpStatus.FORBIDDEN);
    await memberships.update(member.id, { isActive: false });
    await list().expect(HttpStatus.UNAUTHORIZED);
  });
});
