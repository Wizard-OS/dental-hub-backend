import { INestApplication } from '@nestjs/common';
import { Test, TestingModule } from '@nestjs/testing';
import request from 'supertest';
import { App } from 'supertest/types';

import { AppModule } from '../src/app.module';

describe('User sessions by device (e2e)', () => {
  let app: INestApplication<App>;

  beforeAll(async () => {
    const moduleFixture: TestingModule = await Test.createTestingModule({
      imports: [AppModule],
    }).compile();

    app = moduleFixture.createNestApplication();
    await app.init();

    await request(app.getHttpServer()).get('/seed').expect(200);
  });

  afterAll(async () => {
    if (app) {
      await app.close();
    }
  });

  it('lists devices, marks the current session and revokes a selected token', async () => {
    const server = app.getHttpServer();
    const credentials = {
      email: 'test1@google.com',
      password: 'Abc123',
    };

    const desktopLogin = await request(server)
      .post('/auth/login')
      .set('x-device-name', 'MacBook Pro 16"')
      .set(
        'User-Agent',
        'Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/537.36 Chrome/118 Safari/537.36',
      )
      .send(credentials)
      .expect(201);

    const mobileLogin = await request(server)
      .post('/auth/login')
      .set('x-device-name', 'iPhone 15 Pro')
      .set(
        'User-Agent',
        'Mozilla/5.0 (iPhone; CPU iPhone OS 17_0 like Mac OS X) AppleWebKit/605.1.15 Version/17.0 Mobile/15E148 Safari/604.1',
      )
      .send(credentials)
      .expect(201);

    const sessionsResponse = await request(server)
      .get('/user-sessions')
      .set('Authorization', `Bearer ${mobileLogin.body.token}`)
      .expect(200);

    expect(sessionsResponse.body).toEqual(
      expect.arrayContaining([
        expect.objectContaining({
          deviceName: 'MacBook Pro 16"',
          browserName: 'Chrome',
          osName: 'macOS',
          isCurrent: false,
        }),
        expect.objectContaining({
          deviceName: 'iPhone 15 Pro',
          deviceType: 'mobile',
          browserName: 'Safari',
          osName: 'iOS',
          isCurrent: true,
        }),
      ]),
    );

    const desktopSession = sessionsResponse.body.find(
      (session: { deviceName: string }) =>
        session.deviceName === 'MacBook Pro 16"',
    );

    await request(server)
      .delete(`/user-sessions/${desktopSession.id}`)
      .set('Authorization', `Bearer ${mobileLogin.body.token}`)
      .expect(200);

    await request(server)
      .get('/auth/profile')
      .set('Authorization', `Bearer ${desktopLogin.body.token}`)
      .expect(401);

    await request(server)
      .get('/auth/profile')
      .set('Authorization', `Bearer ${mobileLogin.body.token}`)
      .expect(200);
  });
});
