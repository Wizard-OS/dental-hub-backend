import {
  Body,
  Controller,
  Get,
  HttpException,
  INestApplication,
  Logger,
  NotFoundException,
  PayloadTooLargeException,
  Post,
  UnauthorizedException,
} from '@nestjs/common';
import type { Server } from 'node:http';
import { Test } from '@nestjs/testing';
import { I18nModule, I18nValidationPipe } from 'nestjs-i18n';
import request from 'supertest';
import { readFileSync, readdirSync } from 'fs';
import * as path from 'path';
import { CreateUserDto } from '../../auth/dto';
import { AppointmentAvailabilitySettingsDto } from '../../clinics/dto/update-appointment-settings.dto';
import { createI18nOptions } from '../../config/app-module-options';
import { I18nHttpExceptionFilter } from '../filters/i18n-http-exception.filter';
import { I18nResponseInterceptor } from '../interceptors/i18n-response.interceptor';
import { apiMessage } from './api-message';
import { ApiMessageTranslatorService } from './api-message-translator.service';

interface I18nTestResponseBody {
  statusCode?: number;
  error?: string;
  message?: string | string[];
  code?: string;
  id?: string;
  body?: string;
  metadata?: { key: string };
}

function responseBody(response: { body: unknown }): I18nTestResponseBody {
  return response.body as I18nTestResponseBody;
}

function httpRequest(app: INestApplication) {
  return request(app.getHttpServer() as Server);
}

@Controller('i18n-test')
class I18nTestController {
  @Get('error')
  error() {
    throw new NotFoundException(
      apiMessage('api.messages.patient_file_not_found', { id: 'file-123' }),
    );
  }

  @Get('custom-error')
  customError() {
    throw new HttpException(
      {
        code: 'UPLOAD_IDENTITY_REQUIRED',
        message: apiMessage(
          'api.messages.the_uploader_membership_is_unavailable',
        ),
      },
      409,
    );
  }

  @Get('success')
  success() {
    return {
      message: apiMessage('api.messages.password_changed_successfully'),
      id: 'unchanged',
    };
  }

  @Get('plain-success')
  plainSuccess() {
    return apiMessage('api.messages.hello_world');
  }

  @Get('stored')
  stored() {
    return {
      message: 'User not found',
      body: 'Texto del usuario',
      metadata: { key: 'api.http.404' },
    };
  }

  @Get('unauthorized')
  unauthorized() {
    throw new UnauthorizedException();
  }

  @Get('upload')
  upload() {
    throw new PayloadTooLargeException('File too large');
  }

  @Get('unexpected')
  unexpected() {
    throw new Error('private database details');
  }

  @Post('validation')
  validation(@Body() dto: CreateUserDto) {
    return dto;
  }

  @Post('nested')
  nested(@Body() dto: AppointmentAvailabilitySettingsDto) {
    return dto;
  }
}

describe('API internationalization over HTTP', () => {
  let app: INestApplication;

  beforeAll(async () => {
    const module = await Test.createTestingModule({
      imports: [
        I18nModule.forRoot({
          ...createI18nOptions(),
          loaderOptions: {
            path: path.join(__dirname, '../../i18n'),
            watch: false,
          },
        }),
      ],
      controllers: [I18nTestController],
      providers: [
        ApiMessageTranslatorService,
        I18nHttpExceptionFilter,
        I18nResponseInterceptor,
      ],
    }).compile();
    app = module.createNestApplication();
    app.useGlobalPipes(
      new I18nValidationPipe({ whitelist: true, forbidNonWhitelisted: true }),
    );
    app.useGlobalFilters(app.get(I18nHttpExceptionFilter));
    app.useGlobalInterceptors(app.get(I18nResponseInterceptor));
    await app.init();
  });

  afterAll(async () => {
    await app?.close();
  });

  it.each([
    ['?lang=es', {}, 'Contraseña cambiada correctamente'],
    ['?lang=en', { 'x-lang': 'es' }, 'Password changed successfully'],
    [
      '',
      { 'x-lang': 'es', 'x-custom-lang': 'en' },
      'Contraseña cambiada correctamente',
    ],
    [
      '',
      { 'x-custom-lang': 'es', 'Accept-Language': 'en' },
      'Contraseña cambiada correctamente',
    ],
    [
      '',
      { 'Accept-Language': 'fr;q=1,es;q=0.9,en;q=0.5' },
      'Contraseña cambiada correctamente',
    ],
    [
      '',
      { 'Accept-Language': 'es;q=0.2,en;q=0.9' },
      'Password changed successfully',
    ],
    ['?lang=es-UY', {}, 'Contraseña cambiada correctamente'],
    ['?lang=fr', { 'x-lang': 'es' }, 'Password changed successfully'],
    ['', {}, 'Password changed successfully'],
  ])('resolves locale for %s with %j', async (query, headers, expected) => {
    const response = await httpRequest(app)
      .get(`/i18n-test/success${query}`)
      .set(headers)
      .expect(200);
    expect(responseBody(response)).toEqual({
      message: expected,
      id: 'unchanged',
    });
  });

  it('localizes a plain string response', async () => {
    const response = await httpRequest(app)
      .get('/i18n-test/plain-success?lang=es')
      .expect(200);
    expect(response.text).toBe('¡Hola!');
  });

  it('preserves exception status, shape and interpolated arguments', async () => {
    const response = await httpRequest(app)
      .get('/i18n-test/error?lang=es')
      .expect(404);
    expect(responseBody(response)).toEqual({
      statusCode: 404,
      error: 'Not Found',
      message: 'No se encontró el archivo del paciente file-123',
    });
    const custom = await httpRequest(app)
      .get('/i18n-test/custom-error?lang=es')
      .expect(409);
    expect(responseBody(custom)).toEqual({
      code: 'UPLOAD_IDENTITY_REQUIRED',
      message: 'La membresía de quien carga el archivo no está disponible.',
    });
  });

  it('leaves stored message strings and arbitrary objects unchanged', async () => {
    const response = await httpRequest(app)
      .get('/i18n-test/stored?lang=es')
      .expect(200);
    expect(responseBody(response)).toEqual({
      message: 'User not found',
      body: 'Texto del usuario',
      metadata: { key: 'api.http.404' },
    });
  });

  it.each([
    [
      'en',
      'email must be an email',
      'password must be longer than or equal to 6 characters',
      'The password must have a Uppercase, lowercase letter and a number',
    ],
    [
      'es',
      'email debe ser un correo electrónico válido',
      'password debe tener al menos 6 caracteres',
      'La contraseña debe incluir una letra mayúscula, una minúscula y un número',
    ],
  ])(
    'localizes validation in %s while preserving the flat error contract',
    async (lang, email, password, passwordRule) => {
      const response = await httpRequest(app)
        .post(`/i18n-test/validation?lang=${lang}`)
        .send({
          email: 'invalid',
          password: 'x',
          firstName: 'Ana',
          lastName: 'García',
        })
        .expect(400);
      expect(responseBody(response)).toMatchObject({
        statusCode: 400,
        error: 'Bad Request',
      });
      const messages = responseBody(response).message;
      expect(Array.isArray(messages)).toBe(true);
      if (!Array.isArray(messages)) {
        throw new Error('Expected validation messages to be a flat array');
      }
      expect(messages).toEqual(
        expect.arrayContaining([email, password, passwordRule]),
      );
      expect(messages.every((message) => typeof message === 'string')).toBe(
        true,
      );
      expect(JSON.stringify(responseBody(response))).not.toContain(
        'validation.',
      );
    },
  );

  it('localizes whitelist and nested constraints without exposing input values', async () => {
    const response = await httpRequest(app)
      .post('/i18n-test/nested?lang=es')
      .send({ weekly: [{ dayOfWeek: 8, isOpen: true, secret: 'private' }] })
      .expect(400);
    expect(responseBody(response).message).toEqual(
      expect.arrayContaining([
        'weekly.0.dayOfWeek no debe ser mayor que 7',
        'La propiedad weekly.0.secret no está permitida',
      ]),
    );
    expect(JSON.stringify(responseBody(response))).not.toContain('private');
  });

  it('keeps valid DTO content unchanged', async () => {
    const body = {
      email: 'ana@example.com',
      password: 'Abc123',
      firstName: 'Ana',
      lastName: 'García',
    };
    const response = await httpRequest(app)
      .post('/i18n-test/validation?lang=es')
      .send(body)
      .expect(201);
    expect(responseBody(response)).toEqual(body);
  });

  it('localizes framework authentication, upload, and routing errors', async () => {
    const unauthorized = await httpRequest(app)
      .get('/i18n-test/unauthorized?lang=es')
      .expect(401);
    expect(responseBody(unauthorized).message).toBe(
      'Debes autenticarte para continuar',
    );
    const upload = await httpRequest(app)
      .get('/i18n-test/upload?lang=es')
      .expect(413);
    expect(responseBody(upload).message).toBe(
      'El archivo o la solicitud supera el tamaño permitido',
    );
    const missing = await httpRequest(app)
      .get('/not-a-route?lang=es')
      .expect(404);
    expect(responseBody(missing).message).toBe(
      'No se encontró el recurso solicitado',
    );
  });

  it('returns a localized generic error for unexpected failures', async () => {
    const log = jest
      .spyOn(Logger.prototype, 'error')
      .mockImplementation(() => undefined);
    try {
      const response = await httpRequest(app)
        .get('/i18n-test/unexpected?lang=es')
        .expect(500);
      expect(responseBody(response)).toEqual({
        statusCode: 500,
        message: 'Se produjo un error interno. Inténtalo de nuevo más tarde',
      });
    } finally {
      log.mockRestore();
    }
  });
});

describe('translation catalogs', () => {
  function flatten(
    value: Record<string, unknown>,
    prefix = '',
  ): Record<string, string> {
    return Object.fromEntries(
      Object.entries(value).flatMap(([key, entry]) => {
        const name = prefix ? `${prefix}.${key}` : key;
        return typeof entry === 'string'
          ? [[name, entry]]
          : Object.entries(flatten(entry as Record<string, unknown>, name));
      }),
    );
  }

  it('has matching keys and interpolation arguments in every locale', () => {
    const root = path.join(__dirname, '../../i18n');
    for (const file of readdirSync(path.join(root, 'en')).filter((file) =>
      file.endsWith('.json'),
    )) {
      const en = flatten(
        JSON.parse(readFileSync(path.join(root, 'en', file), 'utf8')) as Record<
          string,
          unknown
        >,
      );
      const es = flatten(
        JSON.parse(readFileSync(path.join(root, 'es', file), 'utf8')) as Record<
          string,
          unknown
        >,
      );
      expect(Object.keys(es).sort()).toEqual(Object.keys(en).sort());
      for (const key of Object.keys(en)) {
        expect(es[key].trim()).not.toBe('');
        expect(es[key].match(/\{[^}]+}/g)?.sort() ?? []).toEqual(
          en[key].match(/\{[^}]+}/g)?.sort() ?? [],
        );
      }
    }
  });
});
