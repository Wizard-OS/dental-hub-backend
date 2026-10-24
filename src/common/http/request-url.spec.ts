import type { Request } from 'express';

import { buildRequestBaseUrl } from './request-url';

describe('buildRequestBaseUrl', () => {
  const originalHostApi = process.env.HOST_API;
  const originalNodeEnv = process.env.NODE_ENV;
  const request = {
    protocol: 'https',
    get: jest.fn().mockReturnValue('attacker.example'),
  } as unknown as Request;

  afterEach(() => {
    if (originalHostApi === undefined) delete process.env.HOST_API;
    else process.env.HOST_API = originalHostApi;

    if (originalNodeEnv === undefined) delete process.env.NODE_ENV;
    else process.env.NODE_ENV = originalNodeEnv;
  });

  it('uses the configured public host instead of the request Host header', () => {
    process.env.HOST_API = 'https://api.example.com/api';
    process.env.NODE_ENV = 'production';

    expect(buildRequestBaseUrl(request)).toBe('https://api.example.com');
  });

  it('uses a same-origin relative URL in production without a public host', () => {
    delete process.env.HOST_API;
    process.env.NODE_ENV = 'production';

    expect(buildRequestBaseUrl(request)).toBe('');
  });

  it('uses the request host as a development fallback', () => {
    delete process.env.HOST_API;
    process.env.NODE_ENV = 'development';

    expect(buildRequestBaseUrl(request)).toBe('https://attacker.example');
  });

  it('ignores an insecure configured host in production', () => {
    process.env.HOST_API = 'http://api.example.com/api';
    process.env.NODE_ENV = 'production';

    expect(buildRequestBaseUrl(request)).toBe('');
  });
});
