export function cleanEnvValue(
  value: string | null | undefined,
): string | undefined {
  const cleanValue = value?.trim();

  if (!cleanValue) {
    return undefined;
  }

  const first = cleanValue[0];
  const last = cleanValue[cleanValue.length - 1];

  if ((first === '"' && last === '"') || (first === "'" && last === "'")) {
    return cleanValue.slice(1, -1);
  }

  return cleanValue;
}

export function getEnv(name: string): string | undefined {
  return cleanEnvValue(process.env[name]);
}

export function getRequiredEnv(
  name: string,
  value: string | null | undefined = process.env[name],
): string {
  const cleanValue = cleanEnvValue(value);

  if (!cleanValue) {
    throw new Error(
      `Missing required environment variable ${name}. Set ${name} before starting the application.`,
    );
  }

  return cleanValue;
}

export function getBooleanEnv(name: string): boolean {
  return ['1', 'true', 'yes'].includes(getEnv(name)?.toLowerCase() ?? '');
}

export function normalizeDatabaseUrl(
  databaseUrl: string,
  verifyTls = false,
): string {
  const url = new URL(databaseUrl);
  const sslModes = url.searchParams
    .getAll('sslmode')
    .map((mode) => mode.toLowerCase());
  if (sslModes.some((mode) => ['allow', 'no-verify'].includes(mode))) {
    throw new Error('DATABASE_URL cannot use insecure sslmode values.');
  }
  if (new Set(sslModes).size > 1) {
    throw new Error('DATABASE_URL cannot contain conflicting sslmode values.');
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
  if (sslValues.length > 1 && sslValue) url.searchParams.set('ssl', sslValue);
  if (sslValue && !['true', '1', '0'].includes(sslValue)) {
    throw new Error('DATABASE_URL contains an unsupported ssl parameter.');
  }
  if (
    (verifyTls && (sslMode === 'disable' || sslValue === '0')) ||
    (sslMode === 'disable' && ['true', '1'].includes(sslValue ?? '')) ||
    (sslValue === '0' && sslMode && sslMode !== 'disable')
  ) {
    throw new Error('DB_SSL=true cannot be combined with an insecure sslmode.');
  }
  if (
    sslMode &&
    !['disable', 'prefer', 'require', 'verify-ca', 'verify-full'].includes(
      sslMode,
    )
  ) {
    throw new Error('DATABASE_URL contains an unsupported sslmode.');
  }

  if (sslMode && ['prefer', 'require', 'verify-ca'].includes(sslMode)) {
    url.searchParams.set('sslmode', 'verify-full');
  } else if (verifyTls && !sslMode) {
    url.searchParams.set('sslmode', 'verify-full');
  } else if (verifyTls && sslMode !== 'verify-full' && sslMode !== 'disable') {
    throw new Error('DB_SSL=true requires sslmode=verify-full.');
  }

  return url.toString();
}
