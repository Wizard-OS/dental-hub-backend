type JsonPathSegment = string | number;

function isJsonObject(value: unknown): value is Record<string, unknown> {
  return typeof value === 'object' && value !== null && !Array.isArray(value);
}

function describeType(value: unknown): string {
  if (value === null) return 'null';

  return Array.isArray(value) ? 'array' : typeof value;
}

function locateJsonValue(value: unknown, path: JsonPathSegment[]) {
  let location = 'response body';

  for (const segment of path) {
    if (typeof segment === 'number') {
      if (!Array.isArray(value)) {
        throw new TypeError(
          `Expected ${location} to be an array, received ${describeType(value)}`,
        );
      }

      location += `[${segment}]`;

      if (
        !Number.isInteger(segment) ||
        segment < 0 ||
        segment >= value.length
      ) {
        throw new TypeError(`Expected ${location} to exist`);
      }

      const items: unknown[] = value;

      value = items[segment];
    } else {
      if (!isJsonObject(value)) {
        throw new TypeError(
          `Expected ${location} to be an object, received ${describeType(value)}`,
        );
      }

      location += /^[A-Za-z_$][\w$]*$/.test(segment)
        ? `.${segment}`
        : `[${JSON.stringify(segment)}]`;

      if (!Object.hasOwn(value, segment)) {
        throw new TypeError(`Expected ${location} to exist`);
      }

      value = value[segment];
    }
  }

  return { value, location };
}

export function readJsonValue(
  value: unknown,
  ...path: JsonPathSegment[]
): unknown {
  return locateJsonValue(value, path).value;
}

export function readJsonObject(
  body: unknown,
  ...path: JsonPathSegment[]
): Record<string, unknown> {
  const { value, location } = locateJsonValue(body, path);

  if (!isJsonObject(value)) {
    throw new TypeError(
      `Expected ${location} to be an object, received ${describeType(value)}`,
    );
  }

  return value;
}

export function readJsonArray(
  body: unknown,
  ...path: JsonPathSegment[]
): unknown[] {
  const { value, location } = locateJsonValue(body, path);

  if (!Array.isArray(value)) {
    throw new TypeError(
      `Expected ${location} to be an array, received ${describeType(value)}`,
    );
  }

  return value;
}

export function readJsonString(
  body: unknown,
  ...path: JsonPathSegment[]
): string {
  const { value, location } = locateJsonValue(body, path);

  if (typeof value !== 'string') {
    throw new TypeError(
      `Expected ${location} to be a string, received ${describeType(value)}`,
    );
  }

  return value;
}

export function readJsonBoolean(
  body: unknown,
  ...path: JsonPathSegment[]
): boolean {
  const { value, location } = locateJsonValue(body, path);

  if (typeof value !== 'boolean') {
    throw new TypeError(
      `Expected ${location} to be a boolean, received ${describeType(value)}`,
    );
  }

  return value;
}
