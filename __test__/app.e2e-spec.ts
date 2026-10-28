import { HttpStatus, INestApplication } from '@nestjs/common';
import { Test, TestingModule } from '@nestjs/testing';
import request from 'supertest';
import { App } from 'supertest/types';

import { AppModule } from '../src/app.module';
import { configureTestApplication } from './support/test-application';

describe('AppController (e2e)', () => {
  let app: INestApplication<App>;

  beforeAll(async () => {
    const moduleFixture: TestingModule = await Test.createTestingModule({
      imports: [AppModule],
    }).compile();

    app = moduleFixture.createNestApplication({ bodyParser: false });
    configureTestApplication(app);
    await app.init();
  });

  afterAll(async () => {
    if (app) {
      await app.close();
    }
  });

  it('/ (GET)', () => {
    return request(app.getHttpServer())
      .get('/')
      .expect(HttpStatus.OK)
      .expect('Hello World!');
  });
  it('preserves public informational help endpoints', async () => {
    await request(app.getHttpServer())
      .get('/help-center/faqs')
      .expect(HttpStatus.OK);
    await request(app.getHttpServer())
      .get('/help-center/contact')
      .expect(HttpStatus.OK);
  });
});
