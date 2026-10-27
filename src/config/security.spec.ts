import { getBooleanEnv } from './env';
import {
  allowedCorsOrigins,
  bodyLimit,
  getJwtSecret,
  positiveIntegerEnv,
  validateSecurityEnvironment,
} from './security';

describe('startup security validation', () => {
  const environment = { ...process.env };

  afterEach(() => {
    process.env = { ...environment };
  });

  it.each(['', 'short', 'change_this_secret_that_is_long_enough'])(
    'rejects weak JWT secrets: %s',
    (secret) => {
      expect(() => getJwtSecret(secret)).toThrow();
    },
  );

  it('accepts a long secret and rejects malformed explicit configuration', () => {
    expect(getJwtSecret('secure-random-fixture-with-32-bytes')).toBe(
      'secure-random-fixture-with-32-bytes',
    );
    process.env.PORT = '1.5';
    expect(() => positiveIntegerEnv('PORT', 3000, 65535)).toThrow();
    process.env.ENABLE_SWAGGER = 'tru';
    expect(() => getBooleanEnv('ENABLE_SWAGGER')).toThrow();
    process.env.BODY_JSON_LIMIT = 'unlimited';
    expect(() => bodyLimit('BODY_JSON_LIMIT', '1mb')).toThrow();
  });

  it.each([
    '*',
    'https://example.com/path',
    'https://example.com/',
    'https://user:pass@example.com',
    'null',
  ])('rejects invalid CORS origin %s', (value) => {
    process.env.CORS_ORIGINS = value;
    expect(() => allowedCorsOrigins()).toThrow();
  });

  it.each(['ENABLE_SEED_ENDPOINT', 'ENABLE_DEV_OTP'])(
    'rejects production %s',
    (name) => {
      process.env.NODE_ENV = 'production';
      process.env.JWT_SECRET = 'secure-random-fixture-with-32-bytes';
      process.env[name] = 'true';
      expect(() => validateSecurityEnvironment()).toThrow(/forbidden/);
    },
  );
});
