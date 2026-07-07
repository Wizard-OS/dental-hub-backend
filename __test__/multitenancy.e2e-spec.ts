import { INestApplication } from '@nestjs/common';
import { Test, TestingModule } from '@nestjs/testing';

import request from 'supertest';
import { App } from 'supertest/types';

import { AppModule } from '../src/app.module';

describe('Multi-tenant clinic scope (e2e)', () => {
  let app: INestApplication<App>;
  let adminToken: string;
  let doctorEastToken: string;
  let receptionistToken: string;
  let adminUserId: string;
  let doctorEastUserId: string;
  let receptionistUserId: string;
  let clinicMainId: string;
  let clinicEastId: string;
  let patientAnaId: string;

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

    const adminLogin = await request(app.getHttpServer())
      .post('/auth/login')
      .send({
        email: 'test1@google.com',
        password: 'Abc123',
      })
      .expect(201);

    adminToken = adminLogin.body.token;
    adminUserId = adminLogin.body.id;

    const doctorEastLogin = await request(app.getHttpServer())
      .post('/auth/login')
      .send({
        email: 'test3@google.com',
        password: 'Abc123',
      })
      .expect(201);

    doctorEastToken = doctorEastLogin.body.token;
    doctorEastUserId = doctorEastLogin.body.id;

    const patientAna = await request(app.getHttpServer())
      .get('/patients/ana.perez@example.com')
      .set('Authorization', `Bearer ${adminToken}`)
      .set('x-clinic-id', clinicMainId)
      .expect(200);

    patientAnaId = patientAna.body.id;

    const receptionist = await request(app.getHttpServer())
      .post('/auth/register')
      .send({
        email: `receptionist_${Date.now()}@example.com`,
        password: 'Abc123',
        firstName: 'Recepcion',
        lastName: 'Dental',
      })
      .expect(201);

    receptionistUserId = receptionist.body.id;
    receptionistToken = receptionist.body.token;
  });

  afterAll(async () => {
    if (app) {
      await app.close();
    }
  });

  it('returns active clinic memberships in auth responses', async () => {
    const response = await request(app.getHttpServer())
      .post('/auth/login')
      .send({
        email: 'test1@google.com',
        password: 'Abc123',
      })
      .expect(201);

    expect(response.body.memberships).toEqual(
      expect.arrayContaining([
        expect.objectContaining({
          clinicId: clinicMainId,
          role: 'owner',
        }),
      ]),
    );
  });

  it('lists only clinics where the user has active membership', async () => {
    const clinics = await request(app.getHttpServer())
      .get('/clinics')
      .set('Authorization', `Bearer ${adminToken}`)
      .expect(200);

    expect(clinics.body).toHaveLength(1);
    expect(clinics.body[0].id).toBe(clinicMainId);
  });

  it('rejects clinic scope when user has no membership', async () => {
    await request(app.getHttpServer())
      .get('/patients/sofia.romero@example.com')
      .set('Authorization', `Bearer ${adminToken}`)
      .set('x-clinic-id', clinicEastId)
      .expect(401);
  });

  it('allows duplicate patient contact data across clinics but not inside one clinic', async () => {
    const email = `shared_${Date.now()}@example.com`;
    const phone = `+5989${Date.now().toString().slice(-8)}`;

    await request(app.getHttpServer())
      .post('/patients/create')
      .set('Authorization', `Bearer ${adminToken}`)
      .set('x-clinic-id', clinicMainId)
      .send({
        email,
        phone,
        firstName: 'Paciente',
        lastName: 'Compartido',
        birthDate: '1990-01-01',
        gender: 'Female',
      })
      .expect(201);

    await request(app.getHttpServer())
      .post('/patients/create')
      .set('Authorization', `Bearer ${doctorEastToken}`)
      .set('x-clinic-id', clinicEastId)
      .send({
        email,
        phone,
        firstName: 'Paciente',
        lastName: 'Otra Clinica',
        birthDate: '1990-01-01',
        gender: 'Female',
      })
      .expect(201);

    await request(app.getHttpServer())
      .post('/patients/create')
      .set('Authorization', `Bearer ${adminToken}`)
      .set('x-clinic-id', clinicMainId)
      .send({
        email,
        phone: `${phone}9`,
        firstName: 'Duplicado',
        lastName: 'Misma Clinica',
        birthDate: '1990-01-01',
        gender: 'Female',
      })
      .expect(400);
  });

  it('creates memberships only for owner/admin and blocks receptionist management', async () => {
    await request(app.getHttpServer())
      .post('/clinic-memberships')
      .set('Authorization', `Bearer ${adminToken}`)
      .set('x-clinic-id', clinicMainId)
      .send({
        clinicId: clinicMainId,
        userId: receptionistUserId,
        role: 'receptionist',
      })
      .expect(201);

    await request(app.getHttpServer())
      .get('/clinic-memberships')
      .set('Authorization', `Bearer ${receptionistToken}`)
      .set('x-clinic-id', clinicMainId)
      .expect(403);
  });

  it('rejects treatments assigned to professionals from another clinic', async () => {
    await request(app.getHttpServer())
      .post('/treatments')
      .set('Authorization', `Bearer ${adminToken}`)
      .set('x-clinic-id', clinicMainId)
      .send({
        name: 'Tratamiento cross-tenant',
        patientId: patientAnaId,
        doctorId: doctorEastUserId,
        description: 'No debe permitir profesional de otra clinica',
        basePrice: '250.00',
      })
      .expect(400);
  });

  it('creates a new clinic with owner membership for the authenticated user', async () => {
    const clinic = await request(app.getHttpServer())
      .post('/clinics')
      .set('Authorization', `Bearer ${adminToken}`)
      .send({
        name: `Dental Hub Nueva ${Date.now()}`,
        timezone: 'America/Montevideo',
        currency: 'USD',
      })
      .expect(201);

    const memberships = await request(app.getHttpServer())
      .get('/clinic-memberships')
      .set('Authorization', `Bearer ${adminToken}`)
      .set('x-clinic-id', clinic.body.id)
      .expect(200);

    expect(memberships.body).toEqual(
      expect.arrayContaining([
        expect.objectContaining({
          clinicId: clinic.body.id,
          userId: adminUserId,
          role: 'owner',
        }),
      ]),
    );
  });
});
