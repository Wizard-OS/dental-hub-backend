import { INestApplication } from '@nestjs/common';
import { Test, TestingModule } from '@nestjs/testing';
import request from 'supertest';
import { App } from 'supertest/types';
import { DataSource } from 'typeorm';

import { AppModule } from '../src/app.module';
import {
  readJsonArray,
  readJsonString,
  readJsonValue,
} from './support/json-response';
import {
  configureTestApplication,
  seedTestDatabase,
} from './support/test-application';

jest.setTimeout(30000);

describe('Backoffice SaaS (e2e)', () => {
  let app: INestApplication<App>;
  let dataSource: DataSource;
  let superUserToken: string;
  let adminToken: string;
  let regularUserId: string;
  let clinicId: string;
  let supportRequestId: string;

  beforeAll(async () => {
    const moduleFixture: TestingModule = await Test.createTestingModule({
      imports: [AppModule],
    }).compile();

    app = moduleFixture.createNestApplication({ bodyParser: false });
    configureTestApplication(app);
    await app.init();
    dataSource = app.get(DataSource);

    await seedTestDatabase(app);

    const adminLogin = await request(app.getHttpServer())
      .post('/auth/login')
      .send({
        email: 'test1@google.com',
        password: 'Abc123',
      })
      .expect(201);

    adminToken = readJsonString(adminLogin.body, 'token');

    const superUserLogin = await request(app.getHttpServer())
      .post('/auth/login')
      .send({
        email: 'test2@google.com',
        password: 'Abc123',
      })
      .expect(201);

    superUserToken = readJsonString(superUserLogin.body, 'token');

    const regularUserLogin = await request(app.getHttpServer())
      .post('/auth/login')
      .send({
        email: 'test3@google.com',
        password: 'Abc123',
      })
      .expect(201);

    regularUserId = readJsonString(regularUserLogin.body, 'id');

    const clinics = await request(app.getHttpServer())
      .get('/backoffice/clinics')
      .set('Authorization', `Bearer ${superUserToken}`)
      .expect(200);

    clinicId = readJsonString(clinics.body, 'items', 0, 'id');

    const supportRequest = await request(app.getHttpServer())
      .post('/help-center/support-request')
      .set('Authorization', `Bearer ${adminToken}`)
      .send({
        subject: 'Backoffice support test',
        message: 'Necesito ayuda para validar el panel interno.',
        contactEmail: 'ops@example.com',
      })
      .expect(201);

    supportRequestId = readJsonString(supportRequest.body, 'id');
  });

  afterAll(async () => {
    if (app) {
      await app.close();
    }
  });

  it('rejects non super-user access', async () => {
    await request(app.getHttpServer())
      .get('/backoffice/overview')
      .set('Authorization', `Bearer ${adminToken}`)
      .expect(403);
  });

  it('allows super-user to read global overview without clinic scope', async () => {
    const response = await request(app.getHttpServer())
      .get('/backoffice/overview')
      .set('Authorization', `Bearer ${superUserToken}`)
      .expect(200);

    expect(
      readJsonValue(response.body, 'totals', 'clinics', 'total'),
    ).toBeGreaterThanOrEqual(2);
    expect(
      readJsonValue(response.body, 'totals', 'users', 'total'),
    ).toBeGreaterThanOrEqual(3);
    expect(
      readJsonArray(response.body, 'recentActivity', 'clinics').length,
    ).toBeGreaterThan(0);
  });

  it('lists clinics with subscription and usage summary', async () => {
    const response = await request(app.getHttpServer())
      .get('/backoffice/clinics?limit=5&offset=0')
      .set('Authorization', `Bearer ${superUserToken}`)
      .expect(200);

    expect(readJsonValue(response.body, 'total')).toBeGreaterThanOrEqual(2);
    expect(readJsonValue(response.body, 'items', 0)).toEqual(
      expect.objectContaining<Record<string, unknown>>({
        id: expect.any(String),
        name: expect.any(String),
        owner: expect.any(Object),
        membersCount: expect.any(Number),
        patientsCount: expect.any(Number),
      }),
    );
    expect(readJsonValue(response.body, 'items', 0)).toHaveProperty(
      'subscription',
    );
  });

  it('updates clinic active state from backoffice', async () => {
    const inactive = await request(app.getHttpServer())
      .patch(`/backoffice/clinics/${clinicId}`)
      .set('Authorization', `Bearer ${superUserToken}`)
      .send({ isActive: false })
      .expect(200);

    expect(readJsonValue(inactive.body, 'isActive')).toBe(false);

    const active = await request(app.getHttpServer())
      .patch(`/backoffice/clinics/${clinicId}`)
      .set('Authorization', `Bearer ${superUserToken}`)
      .send({ isActive: true })
      .expect(200);

    expect(readJsonValue(active.body, 'isActive')).toBe(true);
  });

  it('updates user active state and global roles from backoffice', async () => {
    const response = await request(app.getHttpServer())
      .patch(`/backoffice/users/${regularUserId}`)
      .set('Authorization', `Bearer ${superUserToken}`)
      .send({
        isActive: false,
        roles: ['user'],
      })
      .expect(200);

    expect(readJsonValue(response.body, 'isActive')).toBe(false);
    expect(readJsonValue(response.body, 'roles')).toEqual(['user']);
  });

  it('updates a clinic subscription and writes global audit', async () => {
    const response = await request(app.getHttpServer())
      .patch(`/backoffice/clinics/${clinicId}/subscription`)
      .set('Authorization', `Bearer ${superUserToken}`)
      .send({
        planCode: 'premium',
        reason: 'Backoffice e2e upgrade',
      })
      .expect(200);

    expect(readJsonValue(response.body, 'plan', 'code')).toBe('premium');

    const auditRows: unknown = await dataSource.query(
      `
        SELECT "changedByMembershipId", reason
        FROM clinic_subscription_audit_logs
        WHERE "clinicId" = $1
        ORDER BY "createdAt" DESC
        LIMIT 1
      `,
      [clinicId],
    );

    expect(readJsonValue(auditRows, 0, 'changedByMembershipId')).toBeNull();
    expect(readJsonString(auditRows, 0, 'reason')).toBe(
      'Backoffice e2e upgrade',
    );
  });

  it('lists and updates support requests from backoffice', async () => {
    const list = await request(app.getHttpServer())
      .get('/backoffice/support-requests?status=open')
      .set('Authorization', `Bearer ${superUserToken}`)
      .expect(200);

    expect(readJsonValue(list.body, 'items')).toEqual(
      expect.arrayContaining([
        expect.objectContaining({ id: supportRequestId }),
      ]),
    );

    const updated = await request(app.getHttpServer())
      .patch(`/backoffice/support-requests/${supportRequestId}`)
      .set('Authorization', `Bearer ${superUserToken}`)
      .send({ status: 'in_progress' })
      .expect(200);

    expect(readJsonValue(updated.body, 'status')).toBe('in_progress');
  });
});
