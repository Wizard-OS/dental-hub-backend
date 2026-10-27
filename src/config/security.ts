import { getBooleanEnv, getEnv, getRequiredEnv } from './env';

export function getJwtSecret(value = process.env.JWT_SECRET): string {
  const secret = getRequiredEnv('JWT_SECRET', value);

  if (
    Buffer.byteLength(secret, 'utf8') < 32 ||
    /change.?this|change.?me|your.?secret|example|placeholder/i.test(secret)
  ) {
    throw new Error(
      'JWT_SECRET must contain at least 32 bytes and cannot be an example secret.',
    );
  }

  return secret;
}

export function positiveIntegerEnv(
  name: string,
  fallback: number,
  maximum = Number.MAX_SAFE_INTEGER,
): number {
  const raw = getEnv(name);

  if (raw === undefined) return fallback;

  const value = Number(raw);

  if (!Number.isSafeInteger(value) || value < 1 || value > maximum)
    throw new Error(
      `${name} must be a positive integer no greater than ${maximum}.`,
    );

  return value;
}

export function bodyLimit(name: string, fallback: string): string {
  const value = getEnv(name) ?? fallback;

  const match = /^([1-9]\d*)(b|kb|mb)$/i.exec(value);
  const multiplier =
    match?.[2].toLowerCase() === 'mb'
      ? 1024 * 1024
      : match?.[2].toLowerCase() === 'kb'
        ? 1024
        : 1;

  if (!match || !Number.isSafeInteger(Number(match[1]) * multiplier))
    throw new Error(`${name} must be a positive size in b, kb or mb.`);

  return value;
}

export function allowedCorsOrigins(): string[] {
  const origins = (getEnv('CORS_ORIGINS') ?? '')
    .split(',')
    .map((value) => value.trim())
    .filter(Boolean);

  for (const origin of origins) {
    const url = new URL(origin);

    if (!['http:', 'https:'].includes(url.protocol) || url.origin !== origin)
      throw new Error('CORS_ORIGINS must contain exact HTTP(S) origins.');
  }

  return origins;
}

export function validateSecurityEnvironment(): void {
  if (
    !['development', 'test', 'production'].includes(
      getEnv('NODE_ENV') ?? 'development',
    )
  )
    throw new Error('NODE_ENV must be development, test or production.');

  getJwtSecret();
  positiveIntegerEnv('PORT', 3000, 65535);
  positiveIntegerEnv('DB_PORT', 5432, 65535);
  positiveIntegerEnv('THROTTLE_LIMIT', 120);
  positiveIntegerEnv('THROTTLE_TTL_MS', 60000);
  bodyLimit('BODY_JSON_LIMIT', '1mb');
  bodyLimit('BODY_URLENCODED_LIMIT', '256kb');
  allowedCorsOrigins();
  for (const name of [
    'ENABLE_SWAGGER',
    'ENABLE_SEED_ENDPOINT',
    'ENABLE_DEV_OTP',
    'DB_SSL',
    'DB_SYNCHRONIZE',
  ])
    getBooleanEnv(name);

  if (
    getEnv('NODE_ENV') === 'production' &&
    (getBooleanEnv('ENABLE_SEED_ENDPOINT') || getBooleanEnv('ENABLE_DEV_OTP'))
  )
    throw new Error(
      'Seed endpoints and development OTP exposure are forbidden in production.',
    );
}
