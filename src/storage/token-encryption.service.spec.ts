import { InternalServerErrorException } from '@nestjs/common';

import { TokenEncryptionService } from './token-encryption.service';

describe('TokenEncryptionService', () => {
  const originalKey = process.env.INTEGRATION_TOKEN_ENCRYPTION_KEY;

  afterEach(() => {
    process.env.INTEGRATION_TOKEN_ENCRYPTION_KEY = originalKey;
  });

  it('encrypts and decrypts token values with AES-GCM', () => {
    process.env.INTEGRATION_TOKEN_ENCRYPTION_KEY = 'a'.repeat(64);
    const service = new TokenEncryptionService();

    const encrypted = service.encrypt('refresh-token');

    expect(encrypted).not.toBe('refresh-token');
    expect(service.decrypt(encrypted)).toBe('refresh-token');
  });

  it('requires an encryption key', () => {
    delete process.env.INTEGRATION_TOKEN_ENCRYPTION_KEY;
    const service = new TokenEncryptionService();

    expect(() => service.encrypt('refresh-token')).toThrow(
      InternalServerErrorException,
    );
  });

  it('rejects encryption keys shorter than 32 bytes', () => {
    process.env.INTEGRATION_TOKEN_ENCRYPTION_KEY = 'test-secret';
    const service = new TokenEncryptionService();

    expect(() => service.encrypt('refresh-token')).toThrow(
      InternalServerErrorException,
    );
  });
});
