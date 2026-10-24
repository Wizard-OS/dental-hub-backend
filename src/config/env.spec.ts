import {
  createTypeOrmOptions,
  getTrustedProxyHops,
} from './app-module-options';
import { normalizeDatabaseUrl } from './env';

describe('security environment configuration', () => {
  const originalProxyHops = process.env.TRUST_PROXY_HOPS;

  afterEach(() => {
    if (originalProxyHops === undefined) delete process.env.TRUST_PROXY_HOPS;
    else process.env.TRUST_PROXY_HOPS = originalProxyHops;
  });

  it('requires verified TLS for managed database URL modes', () => {
    expect(
      normalizeDatabaseUrl(
        'postgres://user:pass@db.example/app?sslmode=require',
        true,
      ),
    ).toContain('sslmode=verify-full');
    expect(
      normalizeDatabaseUrl('postgres://user:pass@db.example/app', true),
    ).toContain('sslmode=verify-full');
    expect(() =>
      normalizeDatabaseUrl(
        'postgres://user:pass@db.example/app?sslmode=disable',
        true,
      ),
    ).toThrow(/insecure sslmode/);
    expect(() =>
      normalizeDatabaseUrl(
        'postgres://user:pass@db.example/app?sslmode=allow',
        true,
      ),
    ).toThrow(/insecure sslmode/);
    expect(() =>
      normalizeDatabaseUrl('postgres://user:pass@db.example/app?sslmode=allow'),
    ).toThrow(/insecure sslmode/);
    expect(() =>
      normalizeDatabaseUrl(
        'postgres://user:pass@db.example/app?sslmode=no-verify',
      ),
    ).toThrow(/insecure sslmode/);
    expect(() =>
      normalizeDatabaseUrl('postgres://user:pass@db.example/app?ssl=no-verify'),
    ).toThrow(/ssl=no-verify/);
    expect(() =>
      normalizeDatabaseUrl('postgres://user:pass@db.example/app?ssl=0', true),
    ).toThrow(/insecure sslmode/);
    expect(() =>
      normalizeDatabaseUrl(
        'postgres://user:pass@db.example/app?sslmode=verify-full&sslmode=disable',
        true,
      ),
    ).toThrow(/conflicting sslmode/);
  });

  it('keeps explicit local non-SSL PostgreSQL URLs supported', () => {
    expect(
      normalizeDatabaseUrl(
        'postgres://user:pass@localhost/app?sslmode=disable',
      ),
    ).toContain('sslmode=disable');
  });

  it('defaults proxy trust to disabled and accepts only bounded integer hops', () => {
    delete process.env.TRUST_PROXY_HOPS;
    expect(getTrustedProxyHops()).toBe(0);

    process.env.TRUST_PROXY_HOPS = '1';
    expect(getTrustedProxyHops()).toBe(1);

    process.env.TRUST_PROXY_HOPS = '1.5';
    expect(() => getTrustedProxyHops()).toThrow(/integer from 0 to 5/);
  });

  it('requires explicit database connection settings in production', () => {
    const originalEnvironment = {
      NODE_ENV: process.env.NODE_ENV,
      DATABASE_URL: process.env.DATABASE_URL,
      DB_HOST: process.env.DB_HOST,
      DB_NAME: process.env.DB_NAME,
      DB_USERNAME: process.env.DB_USERNAME,
      DB_PASSWORD: process.env.DB_PASSWORD,
      DB_SSL: process.env.DB_SSL,
    };

    try {
      process.env.NODE_ENV = 'production';
      delete process.env.DATABASE_URL;
      delete process.env.DB_HOST;
      delete process.env.DB_NAME;
      delete process.env.DB_USERNAME;
      delete process.env.DB_PASSWORD;

      expect(() => createTypeOrmOptions()).toThrow(/DB_HOST/);

      process.env.DB_HOST = 'db.example';
      process.env.DB_NAME = 'dentalhub';
      process.env.DB_USERNAME = 'dentalhub_app';
      process.env.DB_PASSWORD = 'configured-secret';
      process.env.DB_SSL = 'true';
      expect(createTypeOrmOptions()).toMatchObject({
        host: 'db.example',
        database: 'dentalhub',
        username: 'dentalhub_app',
        password: 'configured-secret',
        ssl: { rejectUnauthorized: true },
      });

      process.env.DB_SSL = 'false';
      expect(() => createTypeOrmOptions()).toThrow(/require DB_SSL=true/);

      process.env.DATABASE_URL =
        'postgres://user:pass@db.example/dentalhub?sslmode=require';
      const options = createTypeOrmOptions();

      expect('url' in options).toBe(true);

      if ('url' in options) {
        expect(options.url).toContain('sslmode=verify-full');
      }
    } finally {
      for (const [name, value] of Object.entries(originalEnvironment)) {
        if (value === undefined) delete process.env[name];
        else process.env[name] = value;
      }
    }
  });
});
