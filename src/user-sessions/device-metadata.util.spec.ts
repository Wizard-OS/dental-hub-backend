import type { Request } from 'express';

import { buildSessionMetadata } from './device-metadata.util';

describe('buildSessionMetadata', () => {
  it('uses Express resolved client IP instead of a caller supplied forwarded header', () => {
    const request = {
      headers: { 'x-forwarded-for': '203.0.113.99', 'user-agent': 'test' },
      ip: '198.51.100.12',
      socket: { remoteAddress: '127.0.0.1' },
    } as unknown as Request;

    expect(buildSessionMetadata(request).ipAddress).toBe('198.51.100.12');
  });

  it('falls back to the socket address when Express has no resolved IP', () => {
    const request = {
      headers: { 'x-forwarded-for': '203.0.113.99' },
      ip: undefined,
      socket: { remoteAddress: '127.0.0.1' },
    } as unknown as Request;

    expect(buildSessionMetadata(request).ipAddress).toBe('127.0.0.1');
  });
});
