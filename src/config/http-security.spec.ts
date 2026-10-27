import type { Server } from 'node:http';

import { Body, Controller, Get, INestApplication, Post } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { APP_GUARD } from '@nestjs/core';
import { JwtService } from '@nestjs/jwt';
import { PassportModule } from '@nestjs/passport';
import { Test } from '@nestjs/testing';
import { Throttle, ThrottlerGuard, ThrottlerModule } from '@nestjs/throttler';
import { getRepositoryToken } from '@nestjs/typeorm';
import { I18nModule } from 'nestjs-i18n';
import request from 'supertest';

import { Public } from '../auth/decorators/public.decorator';
import { CreateUserDto } from '../auth/dto/create-user.dto';
import { User } from '../auth/entities/user.entity';
import { JwtAuthGuard } from '../auth/guards/jwt-auth.guard';
import { JwtStrategy } from '../auth/strategies/jwt.strategy';
import { I18nHttpExceptionFilter } from '../common/filters/i18n-http-exception.filter';
import { ApiMessageTranslatorService } from '../common/i18n/api-message-translator.service';
import { I18nResponseInterceptor } from '../common/interceptors/i18n-response.interceptor';
import { UserSessionsService } from '../user-sessions/user-sessions.service';
import { createI18nOptions } from './app-module-options';
import { configureHttp } from './configure-http';

@Controller('security')
class SecurityController {
  @Get('private')
  privateRoute() {
    return { ok: true };
  }

  @Public()
  @Get('public')
  publicRoute() {
    return { ok: true };
  }

  @Public()
  @Throttle({ default: { limit: 2, ttl: 60000 } })
  @Get('rate')
  rate() {
    return { ok: true };
  }

  @Public()
  @Post('validate')
  validate(@Body() body: CreateUserDto) {
    return { firstName: body.firstName };
  }
}

describe('production HTTP security pipeline', () => {
  let app: INestApplication;
  const environment = { ...process.env };
  const secret = 'secure-random-jwt-fixture-of-more-than-32-bytes';
  const userId = 'a2b58f10-3456-4789-8123-012345678901';
  const sessionId = 'b2b58f10-3456-4789-8123-012345678901';
  const sessions = {
    assertActiveSession: jest.fn(),
    updateLastActive: jest.fn(),
  };
  const users = { findOneBy: jest.fn() };
  const jwt = new JwtService({ secret });

  beforeAll(async () => {
    Object.assign(process.env, {
      NODE_ENV: 'production',
      JWT_SECRET: secret,
      ENABLE_SEED_ENDPOINT: 'false',
      ENABLE_DEV_OTP: 'false',
      CORS_ORIGINS: 'https://client.example',
      BODY_JSON_LIMIT: '1kb',
      TRUST_PROXY_HOPS: '0',
    });
    const module = await Test.createTestingModule({
      imports: [
        ThrottlerModule.forRoot([{ ttl: 60000, limit: 120 }]),
        PassportModule.register({ defaultStrategy: 'jwt' }),
        I18nModule.forRoot(createI18nOptions()),
      ],
      controllers: [SecurityController],
      providers: [
        { provide: APP_GUARD, useClass: ThrottlerGuard },
        JwtStrategy,
        { provide: APP_GUARD, useClass: JwtAuthGuard },
        { provide: ConfigService, useValue: { get: () => secret } },
        { provide: getRepositoryToken(User), useValue: users },
        { provide: UserSessionsService, useValue: sessions },
        ApiMessageTranslatorService,
        I18nHttpExceptionFilter,
        I18nResponseInterceptor,
      ],
    }).compile();

    app = module.createNestApplication({ bodyParser: false });
    configureHttp(app);
    await app.init();
  });

  beforeEach(() => {
    users.findOneBy
      .mockReset()
      .mockResolvedValue({ id: userId, isActive: true });
    sessions.assertActiveSession
      .mockReset()
      .mockResolvedValue({ lastActiveAt: new Date() });
  });

  afterAll(async () => {
    await app?.close();
    process.env = { ...environment };
  });

  it('requires a bearer token on an undecorated route and permits an explicit public route', async () => {
    await request(app.getHttpServer() as Server)
      .get('/api/security/private')
      .expect(401);
    await request(app.getHttpServer() as Server)
      .get('/api/security/public')
      .expect(200)
      .expect('X-Content-Type-Options', 'nosniff');
  });

  it('accepts an active JWT session', async () => {
    const token = jwt.sign({ id: userId, sessionId });

    await request(app.getHttpServer() as Server)
      .get('/api/security/private')
      .auth(token, { type: 'bearer' })
      .expect(200);
  });

  it('rejects expired, wrong-algorithm and wrong-secret tokens', async () => {
    for (const token of [
      jwt.sign({ id: userId, sessionId }, { expiresIn: -1 }),
      jwt.sign({ id: userId, sessionId }, { algorithm: 'HS384' }),
      new JwtService({ secret: 'another-secret' }).sign({
        id: userId,
        sessionId,
      }),
    ]) {
      await request(app.getHttpServer() as Server)
        .get('/api/security/private')
        .auth(token, { type: 'bearer' })
        .expect(401);
    }
    expect(users.findOneBy).not.toHaveBeenCalled();
  });

  it('omits CORS approval for unlisted origins', async () => {
    const denied = await request(app.getHttpServer() as Server)
      .get('/api/security/public')
      .set('Origin', 'https://attacker.example')
      .expect(200);

    expect(denied.headers['access-control-allow-origin']).toBeUndefined();
    await request(app.getHttpServer() as Server)
      .get('/api/security/public')
      .set('Origin', 'https://client.example')
      .expect('Access-Control-Allow-Origin', 'https://client.example');
  });

  it('enforces body size and rejects unknown fields without returning submitted secrets', async () => {
    await request(app.getHttpServer() as Server)
      .post('/api/security/validate')
      .send({ password: 'x'.repeat(2000) })
      .expect(413);
    const response = await request(app.getHttpServer() as Server)
      .post('/api/security/validate')
      .send({ email: 'invalid', password: 'private-secret', admin: true })
      .expect(400);

    expect(JSON.stringify(response.body)).not.toContain('private-secret');
    expect(JSON.stringify(response.body)).not.toContain('target');
  });
  it('enforces rate limits and ignores spoofed forwarded IPs with proxy trust disabled', async () => {
    await request(app.getHttpServer() as Server)
      .get('/api/security/rate')
      .expect(200);
    await request(app.getHttpServer() as Server)
      .get('/api/security/rate')
      .expect(200);
    await request(app.getHttpServer() as Server)
      .get('/api/security/rate')
      .set('X-Forwarded-For', '203.0.113.42')
      .expect(429);
  });

  it('returns 400 for malformed JSON without echoing its contents', async () => {
    const response = await request(app.getHttpServer() as Server)
      .post('/api/security/validate')
      .set('Content-Type', 'application/json')
      .send('{"password":"private-secret"')
      .expect(400);

    expect(JSON.stringify(response.body)).not.toContain('private-secret');
  });
});
