import { Injectable } from '@nestjs/common';
import { createHash, randomBytes } from 'crypto';

import { getEnv } from '../config/env';

@Injectable()
export class MembershipLicenseService {
  generateKey() {
    const segments = Array.from({ length: 3 }, () =>
      randomBytes(3).toString('hex').toUpperCase(),
    );

    return ['DH', 'PREM', ...segments].join('-');
  }

  hashKey(licenseKey: string) {
    const secret =
      getEnv('LICENSE_HASH_SECRET') ??
      getEnv('JWT_SECRET') ??
      'development_license_hash_secret';

    return createHash('sha256').update(`${secret}:${licenseKey}`).digest('hex');
  }
}
