import { apiMessage } from '../common/i18n/api-message';
import { BadRequestException, Injectable } from '@nestjs/common';
import {
  createCipheriv,
  createDecipheriv,
  createHash,
  randomBytes,
} from 'crypto';

@Injectable()
export class TokenEncryptionService {
  encrypt(value: string): string {
    const key = this.getKey();
    const iv = randomBytes(12);
    const cipher = createCipheriv('aes-256-gcm', key, iv);
    const encrypted = Buffer.concat([
      cipher.update(value, 'utf8'),
      cipher.final(),
    ]);
    const tag = cipher.getAuthTag();

    return [
      iv.toString('base64url'),
      tag.toString('base64url'),
      encrypted.toString('base64url'),
    ].join('.');
  }

  decrypt(value: string): string {
    const key = this.getKey();
    const [iv, tag, encrypted] = value.split('.');

    if (!iv || !tag || !encrypted) {
      throw new BadRequestException(
        apiMessage('api.messages.invalid_encrypted_integration_token'),
      );
    }

    const decipher = createDecipheriv(
      'aes-256-gcm',
      key,
      Buffer.from(iv, 'base64url'),
    );
    decipher.setAuthTag(Buffer.from(tag, 'base64url'));

    return Buffer.concat([
      decipher.update(Buffer.from(encrypted, 'base64url')),
      decipher.final(),
    ]).toString('utf8');
  }

  private getKey(): Buffer {
    const secret = process.env.INTEGRATION_TOKEN_ENCRYPTION_KEY;

    if (!secret) {
      throw new BadRequestException(
        apiMessage(
          'api.messages.integration_token_encryption_key_is_required_for_storage_integrations',
        ),
      );
    }

    if (/^[a-f0-9]{64}$/i.test(secret)) {
      return Buffer.from(secret, 'hex');
    }

    const base64 = Buffer.from(secret, 'base64');
    if (base64.length === 32) return base64;

    return createHash('sha256').update(secret).digest();
  }
}
