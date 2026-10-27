import { INestApplication } from '@nestjs/common';
import { Test, TestingModule } from '@nestjs/testing';
import request from 'supertest';
import { App } from 'supertest/types';

import { AppModule } from '../src/app.module';
import { readJsonString, readJsonValue } from './support/json-response';
import {
  configureTestApplication,
  seedTestDatabase,
} from './support/test-application';

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
  let newClinicId: string;
  let patientAnaId: string;

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

    const adminLogin = await request(app.getHttpServer())
      .post('/auth/login')
      .send({
        email: 'test1@google.com',
        password: 'Abc123',
      })
      .expect(201);

    adminToken = readJsonString(adminLogin.body, 'token');
    adminUserId = readJsonString(adminLogin.body, 'id');

    const doctorEastLogin = await request(app.getHttpServer())
      .post('/auth/login')
      .send({
        email: 'test3@google.com',
        password: 'Abc123',
      })
      .expect(201);

    doctorEastToken = readJsonString(doctorEastLogin.body, 'token');
    doctorEastUserId = readJsonString(doctorEastLogin.body, 'id');

    const patientAna = await request(app.getHttpServer())
      .get('/patients/ana.perez@example.com')
      .set('Authorization', `Bearer ${adminToken}`)
      .set('x-clinic-id', clinicMainId)
      .expect(200);

    patientAnaId = readJsonString(patientAna.body, 'id');

    const receptionist = await request(app.getHttpServer())
      .post('/auth/register')
      .send({
        email: `receptionist_${Date.now()}@example.com`,
        password: 'Long dental passphrase 123',
        firstName: 'Recepcion',
        lastName: 'Dental',
      })
      .expect(201);

    receptionistUserId = readJsonString(receptionist.body, 'id');
    receptionistToken = readJsonString(receptionist.body, 'token');
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

    expect(readJsonValue(response.body, 'memberships')).toEqual(
      expect.arrayContaining([
        expect.objectContaining({
          clinicId: clinicMainId,
          role: 'owner',
          clinicCountryCode: 'UY',
          clinicCountryName: 'Uruguay',
          clinicCurrency: 'USD',
          clinicCallingCodes: ['598'],
          clinicDefaultCallingCode: '598',
        }),
      ]),
    );
  });

  it('returns fallback country metadata for authenticated users', async () => {
    const response = await request(app.getHttpServer())
      .get('/common/countries')
      .set('Authorization', `Bearer ${adminToken}`)
      .expect(200);

    expect(response.body).toEqual(
      expect.arrayContaining([
        expect.objectContaining({
          countryCode: 'UY',
          countryName: 'Uruguay',
          defaultCurrency: 'UYU',
          callingCodes: ['598'],
          defaultCallingCode: '598',
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
    expect(readJsonString(clinics.body, 0, 'id')).toBe(clinicMainId);
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
      .patch('/membership/manual')
      .set('Authorization', `Bearer ${adminToken}`)
      .set('x-clinic-id', clinicMainId)
      .send({
        planCode: 'premium',
        reason: 'Allow receptionist membership in multitenancy regression',
      })
      .expect(200);

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

    newClinicId = readJsonString(clinic.body, 'id');
    expect(clinic.body).toEqual(
      expect.objectContaining({
        countryCode: 'UY',
        countryName: 'Uruguay',
        currency: 'USD',
        callingCodes: ['598'],
        defaultCallingCode: '598',
      }),
    );

    const memberships = await request(app.getHttpServer())
      .get('/clinic-memberships')
      .set('Authorization', `Bearer ${adminToken}`)
      .set('x-clinic-id', readJsonString(clinic.body, 'id'))
      .expect(200);

    expect(memberships.body).toEqual(
      expect.arrayContaining([
        expect.objectContaining({
          clinicId: readJsonString(clinic.body, 'id'),
          userId: adminUserId,
          role: 'owner',
        }),
      ]),
    );
  });

  it('derives country metadata on update and respects currency override', async () => {
    const derived = await request(app.getHttpServer())
      .patch(`/clinics/${newClinicId}`)
      .set('Authorization', `Bearer ${adminToken}`)
      .set('x-clinic-id', newClinicId)
      .send({
        countryCode: 'uy',
      })
      .expect(200);

    expect(derived.body).toEqual(
      expect.objectContaining({
        countryCode: 'UY',
        countryName: 'Uruguay',
        currency: 'UYU',
        callingCodes: ['598'],
        defaultCallingCode: '598',
      }),
    );

    const overridden = await request(app.getHttpServer())
      .patch(`/clinics/${newClinicId}`)
      .set('Authorization', `Bearer ${adminToken}`)
      .set('x-clinic-id', newClinicId)
      .send({
        countryCode: 'UY',
        currency: 'USD',
      })
      .expect(200);

    expect(overridden.body).toEqual(
      expect.objectContaining({
        countryCode: 'UY',
        countryName: 'Uruguay',
        currency: 'USD',
        callingCodes: ['598'],
        defaultCallingCode: '598',
      }),
    );
  });
});
