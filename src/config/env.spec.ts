import { getTrustedProxyHops } from './app-module-options';
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
});
