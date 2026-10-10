export function createDatabaseConnectionConfig(environment = process.env) {
  const verifyTls = ['1', 'true', 'yes'].includes(
    environment.DB_SSL?.toLowerCase() ?? '',
  );
  if (environment.DATABASE_URL) {
    const url = new URL(environment.DATABASE_URL);
    const sslModes = url.searchParams
      .getAll('sslmode')
      .map((mode) => mode.toLowerCase());
    if (sslModes.some((mode) => ['allow', 'no-verify'].includes(mode))) {
      throw new Error('DATABASE_URL cannot use insecure sslmode values.');
    }
    if (new Set(sslModes).size > 1) {
      throw new Error(
        'DATABASE_URL cannot contain conflicting sslmode values.',
      );
    }
    const sslMode = sslModes[0];
    if (sslModes.length > 1 && sslMode) {
      url.searchParams.set('sslmode', sslMode);
    }

    const sslValues = url.searchParams
      .getAll('ssl')
      .map((value) => value.toLowerCase());
    if (sslValues.includes('no-verify')) {
      throw new Error('DATABASE_URL cannot use ssl=no-verify.');
    }
    if (new Set(sslValues).size > 1) {
      throw new Error('DATABASE_URL cannot contain conflicting ssl values.');
    }
    const sslValue = sslValues[0];
    if (sslValues.length > 1 && sslValue) {
      url.searchParams.set('ssl', sslValue);
    }
    if (sslValue && !['true', '1', '0'].includes(sslValue)) {
      throw new Error('DATABASE_URL contains an unsupported ssl parameter.');
    }
    if (
      (verifyTls && (sslMode === 'disable' || sslValue === '0')) ||
      (sslMode === 'disable' && ['true', '1'].includes(sslValue ?? '')) ||
      (sslValue === '0' && sslMode && sslMode !== 'disable')
    ) {
      throw new Error(
        'DB_SSL=true cannot be combined with an insecure sslmode.',
      );
    }
    if (
      sslMode &&
      !['disable', 'prefer', 'require', 'verify-ca', 'verify-full'].includes(
        sslMode,
      )
    ) {
      throw new Error('DATABASE_URL contains an unsupported sslmode.');
    }

    if (['prefer', 'require', 'verify-ca'].includes(sslMode)) {
      url.searchParams.set('sslmode', 'verify-full');
    } else if (verifyTls && !sslMode) {
      url.searchParams.set('sslmode', 'verify-full');
    } else if (
      verifyTls &&
      sslMode !== 'verify-full' &&
      sslMode !== 'disable'
    ) {
      throw new Error('DB_SSL=true requires sslmode=verify-full.');
    }

    return {
      connectionString: url.toString(),
      ...(verifyTls ? { ssl: { rejectUnauthorized: true } } : {}),
    };
  }

  return {
    host: environment.DB_HOST ?? '127.0.0.1',
    port: Number(environment.DB_PORT ?? 5432),
    user: environment.DB_USERNAME ?? 'postgres',
    password: environment.DB_PASSWORD,
    database: environment.DB_NAME ?? 'DentalHubDB',
    ...(verifyTls ? { ssl: { rejectUnauthorized: true } } : {}),
  };
}
