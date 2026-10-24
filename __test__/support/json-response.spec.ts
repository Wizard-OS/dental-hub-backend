import {
  readJsonArray,
  readJsonBoolean,
  readJsonObject,
  readJsonString,
  readJsonValue,
} from './json-response';

describe('JSON response readers', () => {
  it('returns valid root values without copying them', () => {
    const object = { id: 'clinic-1' };
    const array = [object];

    expect(readJsonObject(object)).toBe(object);
    expect(readJsonArray(array)).toBe(array);
    expect(readJsonString('token')).toBe('token');
    expect(readJsonString('')).toBe('');
    expect(readJsonBoolean(true)).toBe(true);
    expect(readJsonBoolean(false)).toBe(false);
  });

  it('validates nested object and array paths before reading fields', () => {
    const body = {
      clinicIds: { 'clinic-main': 'clinic-1' },
      items: [{ id: 'patient-1' }],
    };

    expect(readJsonString(body, 'clinicIds', 'clinic-main')).toBe('clinic-1');
    expect(readJsonString(body, 'items', 0, 'id')).toBe('patient-1');
    expect(readJsonArray(body, 'items')).toBe(body.items);
    expect(readJsonObject(body, 'items', 0)).toBe(body.items[0]);
  });

  it('preserves null, boolean, and numeric fields for existing assertions', () => {
    const body = { limit: null, active: false, count: 0 };

    expect(readJsonValue(body, 'limit')).toBeNull();
    expect(readJsonValue(body, 'active')).toBe(false);
    expect(readJsonValue(body, 'count')).toBe(0);
  });

  it.each([null, undefined, [], 'text', 1, true])(
    'rejects a non-object root: %p',
    (value: unknown) => {
      expect(() => readJsonObject(value)).toThrow(
        /response body to be an object/,
      );
    },
  );

  it.each([null, undefined, {}, 'text', 1, true])(
    'rejects a non-array root: %p',
    (value: unknown) => {
      expect(() => readJsonArray(value)).toThrow(
        /response body to be an array/,
      );
    },
  );

  it.each([null, undefined, {}, [], 1, true])(
    'rejects a non-string token with its field path: %p',
    (value: unknown) => {
      expect(() =>
        readJsonString({ auth: { token: value } }, 'auth', 'token'),
      ).toThrow(/response body.auth.token to be a string/);
    },
  );

  it('identifies an invalid intermediate object', () => {
    expect(() => readJsonString({ auth: null }, 'auth', 'token')).toThrow(
      'Expected response body.auth to be an object, received null',
    );
  });

  it.each([null, undefined, {}, [], 0, 1, 'true', 'false'])(
    'rejects a non-boolean default flag: %p',
    (value: unknown) => {
      expect(() => readJsonBoolean({ isDefault: value }, 'isDefault')).toThrow(
        /response body.isDefault to be a boolean/,
      );
    },
  );

  it('rejects object-shaped arrays and identifies their path', () => {
    expect(() => readJsonValue({ items: {} }, 'items', 0)).toThrow(
      'Expected response body.items to be an array, received object',
    );
  });

  it('reports missing properties and array entries', () => {
    expect(() => readJsonString({}, 'token')).toThrow(
      'Expected response body.token to exist',
    );
    expect(() => readJsonString({ items: [] }, 'items', 0, 'id')).toThrow(
      'Expected response body.items[0] to exist',
    );
  });

  it.each([-1, 0.5, NaN])('rejects an invalid array index: %p', (index) => {
    expect(() => readJsonValue(['id'], index)).toThrow(/to exist/);
  });

  it('rejects inherited properties instead of treating them as JSON fields', () => {
    expect(() => readJsonValue({}, 'toString')).toThrow(
      'Expected response body.toString to exist',
    );
  });
});
