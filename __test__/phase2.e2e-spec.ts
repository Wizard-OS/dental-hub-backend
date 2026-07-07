import { INestApplication } from '@nestjs/common';
import { Test, TestingModule } from '@nestjs/testing';

import request from 'supertest';
import { App } from 'supertest/types';

import { AppModule } from '../src/app.module';

describe('Phase 2 Flow (e2e)', () => {
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
    clinicEastId = seedResponse.body.clinicIds['clinic-east'];

    const loginResponse = await request(app.getHttpServer())
      .post('/auth/login')
      .send({
        email: 'test1@google.com',
        password: 'Abc123',
      })
      .expect(201);

    adminToken = loginResponse.body.token;
    adminUserId = loginResponse.body.id;

    const patientAna = await request(app.getHttpServer())
      .get('/patients/ana.perez@example.com')
      .set('Authorization', `Bearer ${adminToken}`)
      .set('x-clinic-id', clinicMainId)
      .expect(200);

    const patientLuis = await request(app.getHttpServer())
      .get('/patients/luis.mendez@example.com')
      .set('Authorization', `Bearer ${adminToken}`)
      .set('x-clinic-id', clinicMainId)
      .expect(200);

    patientAnaId = patientAna.body.id;
    patientLuisId = patientLuis.body.id;
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
      .expect(201);

    clinicalRecordAnaId = recordAna.body.id;

    const recordLuis = await request(app.getHttpServer())
      .post('/clinical-records')
      .set('Authorization', `Bearer ${adminToken}`)
      .set('x-clinic-id', clinicMainId)
      .send({
        patientId: patientLuisId,
        allergies: 'None',
      })
      .expect(201);

    clinicalRecordLuisId = recordLuis.body.id;

    await request(app.getHttpServer())
      .post('/clinical-records')
      .set('Authorization', `Bearer ${adminToken}`)
      .set('x-clinic-id', clinicMainId)
      .send({
        patientId: patientAnaId,
      })
      .expect(400);
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
      .expect(401);
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
      .expect(201);

    treatmentAnaId = treatment.body.id;

    await request(app.getHttpServer())
      .post('/treatment-sessions')
      .set('Authorization', `Bearer ${adminToken}`)
      .set('x-clinic-id', clinicMainId)
      .send({
        treatmentId: treatmentAnaId,
        clinicalRecordId: clinicalRecordAnaId,
        price: '150.00',
        performedAt: new Date().toISOString(),
      })
      .expect(201);
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
      .expect(400);
  });
});
