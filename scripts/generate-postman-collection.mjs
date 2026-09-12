#!/usr/bin/env node

import fs from 'node:fs/promises';
import path from 'node:path';
import process from 'node:process';

const DEFAULT_SOURCE = 'http://localhost:3000/api/docs-json';
const DEFAULT_OUT =
  '__docs__/postman/dentalhub-backend.postman_collection.json';
const POSTMAN_SCHEMA =
  'https://schema.getpostman.com/json/collection/v2.1.0/collection.json';

const HTTP_METHODS = new Set([
  'get',
  'post',
  'put',
  'patch',
  'delete',
  'options',
  'head',
]);

const REQUIRED_VARIABLES = [
  ['baseUrl', 'http://localhost:3000/api'],
  ['token', ''],
  ['clinicId', ''],
  ['clinicMainId', ''],
  ['clinicEastId', ''],
  ['currentUserId', ''],
  ['createdUserId', ''],
  ['createdClinicId', ''],
  ['clinicMembershipId', ''],
  ['patientId', ''],
  ['patientSearchTerm', ''],
  ['appointmentTypeId', ''],
  ['appointmentId', ''],
  ['clinicalRecordId', ''],
  ['clinicalNoteId', ''],
  ['toothCode', '36'],
  ['treatmentId', ''],
  ['treatmentSessionId', ''],
  ['invoiceId', ''],
  ['invoiceItemId', ''],
  ['paymentId', ''],
  ['expenseId', ''],
  ['templateId', ''],
  ['reminderId', ''],
  ['outboundMessageId', ''],
  ['paymentMethodId', ''],
  ['patientFileId', ''],
  ['patientAssignmentId', ''],
  ['userSessionId', ''],
  ['supportRequestId', ''],
  ['membershipPaymentMethodId', ''],
  ['membershipSetupSessionId', ''],
  ['membershipChargeId', ''],
  ['membershipRequestId', ''],
  ['billingInterval', 'monthly'],
  ['paypalSubscriptionId', ''],
  ['paypalApprovalUrl', ''],
  ['paypalWebhookEventId', ''],
  ['paypalTransmissionId', ''],
  ['paypalTransmissionTime', ''],
  ['paypalTransmissionSig', ''],
  ['paypalCertUrl', ''],
  ['paypalAuthAlgo', ''],
];

const PUBLIC_PATHS = new Set([
  '/seed',
  '/auth/login',
  '/auth/register',
  '/billing/webhooks/paypal',
  '/help-center/faqs',
  '/help-center/contact',
]);

function parseArgs(argv) {
  const args = {
    source: DEFAULT_SOURCE,
    out: DEFAULT_OUT,
    check: false,
  };

  for (let i = 0; i < argv.length; i += 1) {
    const arg = argv[i];

    if (arg === '--source') {
      args.source = argv[++i];
      continue;
    }

    if (arg === '--out') {
      args.out = argv[++i];
      continue;
    }

    if (arg === '--check') {
      args.check = true;
      continue;
    }

    if (arg === '--help' || arg === '-h') {
      printHelp();
      process.exit(0);
    }

    throw new Error(`Unknown argument: ${arg}`);
  }

  return args;
}

function printHelp() {
  console.log(`Usage:
  node scripts/generate-postman-collection.mjs [--source <url-or-file>] [--out <file>] [--check]

Defaults:
  --source ${DEFAULT_SOURCE}
  --out    ${DEFAULT_OUT}
`);
}

async function readJsonIfExists(filePath) {
  try {
    return JSON.parse(await fs.readFile(filePath, 'utf8'));
  } catch (error) {
    if (error.code === 'ENOENT') return null;
    throw error;
  }
}

async function readOpenApi(source) {
  if (/^https?:\/\//i.test(source)) {
    let response;
    try {
      response = await fetch(source);
    } catch (error) {
      throw new Error(
        `No pude conectar con ${source}. Levanta la API local antes de generar la colección (por ejemplo, ./node_modules/.bin/nest start). Detalle: ${error.message}`,
      );
    }

    if (!response.ok) {
      throw new Error(
        `Swagger respondió ${response.status} ${response.statusText} en ${source}.`,
      );
    }

    return await response.json();
  }

  return JSON.parse(await fs.readFile(source, 'utf8'));
}

async function formatJson(value) {
  const json = `${JSON.stringify(value, null, 2)}\n`;

  try {
    const prettier = await import('prettier');
    const formatted = await prettier.format(json, { parser: 'json' });
    return formatted.endsWith('\n') ? formatted : `${formatted}\n`;
  } catch (error) {
    if (
      error.code === 'ERR_MODULE_NOT_FOUND' ||
      error.message.includes('Cannot find package')
    ) {
      return json;
    }

    throw error;
  }
}

function normalizeOpenApiPath(openApiPath) {
  const withoutApi = openApiPath.replace(/^\/api(?=\/|$)/, '');
  return withoutApi || '/';
}

function normalizePostmanPath(rawUrl) {
  const raw = typeof rawUrl === 'string' ? rawUrl : (rawUrl?.raw ?? '');
  if (!raw) return '';

  let normalized = raw
    .replace(/^https?:\/\/[^/]+\/api/, '')
    .replace(/^https?:\/\/[^/]+/, '')
    .replace(/^{{baseUrl}}/, '')
    .replace(/^\/api(?=\/|$)/, '');

  const queryIndex = normalized.indexOf('?');
  if (queryIndex >= 0) normalized = normalized.slice(0, queryIndex);

  return normalized || '/';
}

function endpointKey(method, pathName) {
  return `${method.toUpperCase()} ${normalizeOpenApiPath(pathName)}`;
}

function collectExistingItems(collection) {
  const byEndpoint = new Map();

  function walk(items, folderPath = []) {
    for (const item of items ?? []) {
      if (item.item) {
        walk(item.item, [...folderPath, item.name]);
        continue;
      }

      if (!item.request?.method) continue;

      const key = `${item.request.method.toUpperCase()} ${normalizePostmanPath(
        item.request.url,
      )}`;

      if (!byEndpoint.has(key)) {
        byEndpoint.set(key, { item, folderPath });
      }
    }
  }

  walk(collection?.item ?? []);
  return byEndpoint;
}

function upsertVariables(existingVariables, extraVariableNames) {
  const variables = [];
  const seen = new Set();

  function pushVariable(key, value = '') {
    if (seen.has(key)) return;
    seen.add(key);
    variables.push({ key, value, type: 'string' });
  }

  for (const variable of existingVariables ?? []) {
    if (variable?.key) {
      seen.add(variable.key);
      variables.push(variable);
    }
  }

  for (const [key, value] of REQUIRED_VARIABLES) {
    pushVariable(key, value);
  }

  for (const key of [...extraVariableNames].sort()) {
    pushVariable(key, defaultVariableValue(key));
  }

  return variables;
}

function defaultVariableValue(key) {
  if (key === 'toothCode') return '36';
  if (key === 'patientSearchTerm') return '{{patientId}}';
  return '';
}

function collectionPrerequestEvent() {
  return {
    listen: 'prerequest',
    script: {
      type: 'text/javascript',
      exec: [
        "if (!pm.collectionVariables.get('baseUrl')) {",
        "  pm.collectionVariables.set('baseUrl', 'http://localhost:3000/api');",
        '}',
        '',
        `const publicPaths = ${JSON.stringify([...PUBLIC_PATHS])};`,
        "const requestPath = `/${pm.request.url.path.join('/')}`.replace(/^\\/api(?=\\/|$)/, '');",
        'const isPublicRequest = publicPaths.includes(requestPath);',
        "const token = pm.environment.get('token') || pm.collectionVariables.get('token');",
        'if (token) {',
        "  pm.request.headers.upsert({ key: 'Authorization', value: `Bearer ${token}` });",
        '} else if (!isPublicRequest) {',
        "  throw new Error('Falta token. Ejecuta primero Auth / Iniciar sesión y verifica que token tenga valor.');",
        '}',
      ],
    },
  };
}

function bearerAuth() {
  return {
    type: 'bearer',
    bearer: [
      {
        key: 'token',
        value: '{{token}}',
        type: 'string',
      },
    ],
  };
}

function operationSecurity(operation, openapi) {
  if (operation.security !== undefined) return operation.security;
  return openapi.security ?? [];
}

function requiresClinicId(operation, openapi) {
  return operationSecurity(operation, openapi).some((entry) =>
    Object.prototype.hasOwnProperty.call(entry, 'x-clinic-id'),
  );
}

function resolveRef(openapi, ref) {
  if (!ref?.startsWith('#/')) return undefined;

  return ref
    .slice(2)
    .split('/')
    .reduce((value, part) => value?.[part], openapi);
}

function resolveSchema(openapi, schema, seen = new Set()) {
  if (!schema) return {};

  if (schema.$ref) {
    if (seen.has(schema.$ref)) return {};
    seen.add(schema.$ref);
    return resolveSchema(openapi, resolveRef(openapi, schema.$ref), seen);
  }

  if (schema.allOf) {
    return schema.allOf.reduce(
      (merged, part) =>
        mergeSchemas(merged, resolveSchema(openapi, part, seen)),
      {},
    );
  }

  if (schema.oneOf?.length)
    return resolveSchema(openapi, schema.oneOf[0], seen);
  if (schema.anyOf?.length)
    return resolveSchema(openapi, schema.anyOf[0], seen);

  return schema;
}

function mergeSchemas(left, right) {
  return {
    ...left,
    ...right,
    properties: {
      ...(left.properties ?? {}),
      ...(right.properties ?? {}),
    },
    required: [
      ...new Set([...(left.required ?? []), ...(right.required ?? [])]),
    ],
  };
}

function exampleForSchema(openapi, schema, propertyName = 'value') {
  const resolved = resolveSchema(openapi, schema);

  if (resolved.example !== undefined) return resolved.example;
  if (resolved.default !== undefined) return resolved.default;
  if (resolved.enum?.length) return resolved.enum[0];

  if (resolved.type === 'array') {
    return [
      exampleForSchema(openapi, resolved.items ?? {}, singular(propertyName)),
    ];
  }

  if (resolved.type === 'object' || resolved.properties) {
    const output = {};
    const properties = resolved.properties ?? {};
    for (const [key, propertySchema] of Object.entries(properties)) {
      const property = resolveSchema(openapi, propertySchema);
      if (property.readOnly) continue;
      output[key] = exampleForSchema(openapi, property, key);
    }
    return output;
  }

  if (resolved.format === 'uuid')
    return `{{${variableForProperty(propertyName)}}}`;
  if (resolved.format === 'date-time')
    return new Date(2030, 0, 1).toISOString();
  if (resolved.format === 'date') return '2030-01-01';
  if (resolved.format === 'binary') return '';

  switch (resolved.type) {
    case 'integer':
    case 'number':
      return 1;
    case 'boolean':
      return true;
    case 'string':
    default:
      return exampleString(propertyName);
  }
}

function singular(value) {
  return value.endsWith('s') ? value.slice(0, -1) : value;
}

function variableForProperty(propertyName) {
  const lower = propertyName.toLowerCase();
  if (lower.includes('clinicmembership')) return 'clinicMembershipId';
  if (lower.includes('appointmenttype')) return 'appointmentTypeId';
  if (lower.includes('clinicalrecord')) return 'clinicalRecordId';
  if (lower.includes('clinicalnote')) return 'clinicalNoteId';
  if (lower.includes('treatmentsession')) return 'treatmentSessionId';
  if (lower.includes('invoiceitem') || lower === 'itemid')
    return 'invoiceItemId';
  if (lower.includes('outboundmessage')) return 'outboundMessageId';
  if (lower.includes('paymentmethod')) return 'paymentMethodId';
  if (lower.includes('patientfile')) return 'patientFileId';
  if (lower.includes('appointment')) return 'appointmentId';
  if (lower.includes('patient')) return 'patientId';
  if (lower.includes('treatment')) return 'treatmentId';
  if (lower.includes('invoice')) return 'invoiceId';
  if (lower.includes('payment')) return 'paymentId';
  if (lower.includes('template')) return 'templateId';
  if (lower.includes('reminder')) return 'reminderId';
  if (lower.includes('expense')) return 'expenseId';
  if (lower.includes('user')) return 'currentUserId';
  if (lower === 'id') return 'id';
  return propertyName;
}

function exampleString(propertyName) {
  const lower = propertyName.toLowerCase();
  if (lower.includes('email')) return `postman_{{$timestamp}}@example.com`;
  if (lower.includes('password')) return 'Abc123';
  if (lower.includes('phone')) return '+59890000000';
  if (lower.includes('currency')) return 'USD';
  if (lower.includes('timezone')) return 'America/Montevideo';
  if (
    lower.includes('amount') ||
    lower.includes('price') ||
    lower.includes('total')
  ) {
    return '100.00';
  }
  if (lower.includes('date')) return '2030-01-01';
  if (lower.includes('status')) return 'pending';
  if (lower.includes('gender')) return 'Female';
  if (lower.includes('tooth')) return '{{toothCode}}';
  if (lower.includes('method')) return 'cash';
  if (lower.includes('channel')) return 'email';
  if (lower.includes('name')) return `Postman {{$timestamp}}`;
  if (lower.includes('description')) return 'Generado desde Postman';
  if (lower.includes('content') || lower.includes('body'))
    return 'Texto generado desde Postman';
  return `{{${propertyName}}}`;
}

function requestBodyForOperation(openapi, operation) {
  const content = operation.requestBody?.content ?? {};

  if (content['multipart/form-data']) {
    const schema = resolveSchema(
      openapi,
      content['multipart/form-data'].schema,
    );
    const formdata = Object.entries(schema.properties ?? {}).map(
      ([key, propertySchema]) => {
        const property = resolveSchema(openapi, propertySchema);
        if (property.format === 'binary') {
          return {
            key,
            type: 'file',
            src: [],
          };
        }

        return {
          key,
          type: 'text',
          value: String(exampleForSchema(openapi, property, key)),
        };
      },
    );

    return {
      mode: 'formdata',
      formdata,
    };
  }

  const jsonContent = content['application/json'];
  if (!jsonContent) return undefined;

  const example = exampleForSchema(openapi, jsonContent.schema ?? {});
  return {
    mode: 'raw',
    raw: JSON.stringify(example, null, 2),
    options: {
      raw: {
        language: 'json',
      },
    },
  };
}

function pathParamNames(pathName) {
  return [...pathName.matchAll(/\{([^}]+)\}/g)].map((match) => match[1]);
}

function variableForPathParam(paramName, pathName) {
  if (paramName === 'term') return 'patientId';
  if (paramName === 'itemId') return 'invoiceItemId';
  if (paramName !== 'id') return paramName;

  if (normalizeOpenApiPath(pathName).startsWith('/membership/')) {
    if (pathName.includes('/payment-methods/setup/'))
      return 'membershipSetupSessionId';
    if (pathName.includes('/payment-methods/'))
      return 'membershipPaymentMethodId';
    if (pathName.includes('/charges/')) return 'membershipChargeId';
  }
  const segments = normalizeOpenApiPath(pathName).split('/').filter(Boolean);
  const idIndex = segments.findIndex((segment) => segment === '{id}');
  const previous = segments[idIndex - 1];
  const beforePrevious = segments[idIndex - 2];

  if (previous === 'types' && beforePrevious === 'appointments') {
    return 'appointmentTypeId';
  }

  const bySegment = {
    clinics: 'clinicId',
    'clinic-memberships': 'clinicMembershipId',
    patients: 'patientId',
    appointments: 'appointmentId',
    'clinical-records': 'clinicalRecordId',
    'clinical-notes': 'clinicalNoteId',
    treatments: 'treatmentId',
    'treatment-sessions': 'treatmentSessionId',
    invoices: 'invoiceId',
    payments: 'paymentId',
    expenses: 'expenseId',
    'message-templates': 'templateId',
    reminders: 'reminderId',
    'outbound-messages': 'outboundMessageId',
    'payment-methods': 'paymentMethodId',
    'user-sessions': 'userSessionId',
    'patient-files': 'patientFileId',
    'patient-assignments': 'patientAssignmentId',
    'support-requests': 'supportRequestId',
    users: 'currentUserId',
  };

  return bySegment[previous] ?? `${camelCase(previous ?? 'resource')}Id`;
}

function postmanPath(pathName, extraVariables) {
  return normalizeOpenApiPath(pathName)
    .split('/')
    .filter(Boolean)
    .map((segment) => {
      const match = segment.match(/^\{([^}]+)\}$/);
      if (!match) return segment;
      const variableName = variableForPathParam(match[1], pathName);
      extraVariables.add(variableName);
      return `{{${variableName}}}`;
    });
}

function queryParamsForOperation(operation) {
  return (operation.parameters ?? [])
    .filter((parameter) => parameter.in === 'query')
    .map((parameter) => ({
      key: parameter.name,
      value: String(
        exampleForSchema(
          { components: {} },
          parameter.schema ?? {},
          parameter.name,
        ),
      ),
      disabled: !parameter.required,
    }));
}

function requestName(method, pathName, operation, existingItem) {
  if (existingItem?.name) return existingItem.name;
  if (operation.summary) return operation.summary;
  return `${method.toUpperCase()} ${normalizeOpenApiPath(pathName)}`;
}

function folderName(operation, existingFolderPath) {
  if (existingFolderPath?.length) return existingFolderPath[0];
  return operation.tags?.[0] ?? 'General';
}

function buildItem(
  openapi,
  method,
  pathName,
  operation,
  existing,
  extraVariables,
) {
  const methodUpper = method.toUpperCase();
  const pathParts = postmanPath(pathName, extraVariables);
  const query = queryParamsForOperation(operation);
  const rawPath = `{{baseUrl}}/${pathParts.join('/')}${query.length ? `?${query.map((q) => `${q.key}=${q.value}`).join('&')}` : ''}`;
  const headers = [];

  if (requiresClinicId(operation, openapi)) {
    headers.push({
      key: 'x-clinic-id',
      value: '{{clinicId}}',
      type: 'text',
    });
  }

  const body = requestBodyForOperation(openapi, operation);
  if (
    body?.mode === 'raw' &&
    normalizeOpenApiPath(pathName).startsWith('/membership/')
  ) {
    const value = JSON.parse(body.raw);
    if ('paymentMethodId' in value)
      value.paymentMethodId = '{{membershipPaymentMethodId}}';
    if ('requestId' in value) value.requestId = '{{membershipRequestId}}';
    body.raw = JSON.stringify(value, null, 2);
  }
  const item = {
    name: requestName(method, pathName, operation, existing?.item),
    request: {
      method: methodUpper,
      header: headers,
      url: {
        raw: rawPath,
        host: ['{{baseUrl}}'],
        path: pathParts,
        ...(query.length ? { query } : {}),
      },
      description: operation.description ?? operation.summary ?? '',
      ...(body ? { body } : {}),
    },
  };

  if (existing?.item?.event?.length) {
    item.event = existing.item.event;
  }

  return item;
}

function camelCase(value) {
  return String(value)
    .replace(/[-_\s]+(.)?/g, (_, char) => (char ? char.toUpperCase() : ''))
    .replace(/^(.)/, (char) => char.toLowerCase());
}

function buildCollection(openapi, existingCollection) {
  const existingByEndpoint = collectExistingItems(existingCollection);
  const extraVariables = new Set();
  const folders = new Map();

  for (const [pathName, pathItem] of Object.entries(openapi.paths ?? {})) {
    for (const [method, operation] of Object.entries(pathItem)) {
      if (!HTTP_METHODS.has(method)) continue;

      for (const paramName of pathParamNames(pathName)) {
        extraVariables.add(variableForPathParam(paramName, pathName));
      }

      const key = endpointKey(method, pathName);
      const existing = existingByEndpoint.get(key);
      const folder = folderName(operation, existing?.folderPath);
      const item = buildItem(
        openapi,
        method,
        pathName,
        operation,
        existing,
        extraVariables,
      );

      if (!folders.has(folder)) folders.set(folder, []);
      folders.get(folder).push(item);
    }
  }

  const item = [...folders.entries()]
    .sort(([left], [right]) => left.localeCompare(right))
    .map(([name, folderItems]) => ({
      name,
      item: folderItems.sort((left, right) =>
        `${left.request.method} ${left.request.url.raw}`.localeCompare(
          `${right.request.method} ${right.request.url.raw}`,
        ),
      ),
    }));

  return {
    info: {
      _postman_id:
        existingCollection?.info?._postman_id ??
        'f5f3b36d-4db2-4e5d-91c4-dentalhubbackend',
      name:
        existingCollection?.info?.name ??
        openapi.info?.title ??
        'DentalHub Backend API',
      description:
        existingCollection?.info?.description ??
        'Colección importable para DentalHub Backend generada desde Swagger/OpenAPI.',
      schema: POSTMAN_SCHEMA,
    },
    auth: existingCollection?.auth ?? bearerAuth(),
    event: [collectionPrerequestEvent()],
    variable: upsertVariables(
      existingCollection?.variable ?? [],
      extraVariables,
    ),
    item,
  };
}

async function main() {
  const args = parseArgs(process.argv.slice(2));
  const outPath = path.resolve(args.out);
  const openapi = await readOpenApi(args.source);
  const existingCollection = await readJsonIfExists(outPath);
  const collection = buildCollection(openapi, existingCollection);
  const output = await formatJson(collection);

  if (args.check) {
    const current = await fs.readFile(outPath, 'utf8');
    if (current !== output) {
      console.error(
        `La colección Postman está desactualizada. Ejecuta: node scripts/generate-postman-collection.mjs --source ${args.source} --out ${args.out}`,
      );
      process.exit(1);
    }

    console.log(`Colección Postman actualizada: ${args.out}`);
    return;
  }

  await fs.mkdir(path.dirname(outPath), { recursive: true });
  await fs.writeFile(outPath, output);
  console.log(`Colección Postman generada: ${args.out}`);
  console.log(
    `Endpoints incluidos: ${Object.values(openapi.paths ?? {}).reduce(
      (count, pathItem) =>
        count +
        Object.keys(pathItem).filter((method) => HTTP_METHODS.has(method))
          .length,
      0,
    )}`,
  );
}

main().catch((error) => {
  console.error(error.message);
  process.exit(1);
});
