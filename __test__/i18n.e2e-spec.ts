import { INestApplication } from '@nestjs/common';
import { Test, TestingModule } from '@nestjs/testing';

import request from 'supertest';
import { App } from 'supertest/types';

import { AppModule } from '../src/app.module';
import { I18nValidationPipe } from 'nestjs-i18n';
import { I18nHttpExceptionFilter } from '../src/common/filters/i18n-http-exception.filter';
import { I18nResponseInterceptor } from '../src/common/interceptors/i18n-response.interceptor';

describe('i18n responses (e2e)', () => {
  let app: INestApplication<App>;
  let adminToken: string;
  let clinicMainId: string;

  beforeAll(async () => {
    const moduleFixture: TestingModule = await Test.createTestingModule({
      imports: [AppModule],
    }).compile();

    app = moduleFixture.createNestApplication();
    app.useGlobalPipes(
      new I18nValidationPipe({ whitelist: true, forbidNonWhitelisted: true }),
    );
    app.useGlobalFilters(app.get(I18nHttpExceptionFilter));
    app.useGlobalInterceptors(app.get(I18nResponseInterceptor));
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
  });

  afterAll(async () => {
    if (app) {
      await app.close();
    }
  });

  it('translates auth error to Spanish using lang query param', async () => {
    const response = await request(app.getHttpServer())
      .post('/auth/login?lang=es')
      .send({
        email: 'noexiste@example.com',
        password: 'WrongPass123',
      })
      .expect(401);

    expect(response.body.message).toBe('Credenciales inválidas');
  });

  it('translates auth error to English using x-lang header', async () => {
    const response = await request(app.getHttpServer())
      .post('/auth/login')
      .set('x-lang', 'en')
      .send({
        email: 'noexiste@example.com',
        password: 'WrongPass123',
      })
      .expect(401);

    expect(response.body.message).toBe('Credentials are not valid');
  });

  it('prioritizes lang query over x-lang header in protected endpoints', async () => {
    const response = await request(app.getHttpServer())
      .get('/appointments/not-a-uuid?lang=es')
      .set('Authorization', `Bearer ${adminToken}`)
      .set('x-clinic-id', clinicMainId)
      .set('x-lang', 'en')
      .expect(400);

    expect(response.body.message).toBe('El ID de la cita no es válido');
  });

  it('falls back to English when unsupported language is requested', async () => {
    const response = await request(app.getHttpServer())
      .post('/auth/login?lang=fr')
      .send({
        email: 'noexiste@example.com',
        password: 'WrongPass123',
      })
      .expect(401);

    expect(response.body.message).toBe('Credentials are not valid');
  });
});
