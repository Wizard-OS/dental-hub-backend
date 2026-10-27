export const MINIMUM_PASSWORD_LENGTH = 15;
export const MAXIMUM_PASSWORD_BYTES = 72;

export function fitsPasswordByteLimit(value: unknown): boolean {
  return (
    typeof value === 'string' &&
    new TextEncoder().encode(value).length <= MAXIMUM_PASSWORD_BYTES
  );
}
