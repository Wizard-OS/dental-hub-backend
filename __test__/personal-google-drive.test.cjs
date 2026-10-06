// Run after building: node --test __test__/personal-google-drive.test.cjs
const { test, mock } = require('node:test');
const assert = require('node:assert/strict');
const { Readable } = require('node:stream');
const { createHash } = require('node:crypto');
const fs = require('node:fs/promises');
const path = require('node:path');
const { StorageService } = require('../dist/storage/storage.service');
const {
  PersonalDriveStorage,
} = require('../dist/storage/infrastructure/personal-drive-storage');
const {
  PatientFile,
} = require('../dist/patient-files/entities/patient-file.entity');
const { Patient } = require('../dist/patients/entities/patient.entity');
const {
  DriveMigrationItem,
} = require('../dist/storage/entities/drive-migration-item.entity');
const {
  GoogleTokenVerifier,
} = require('../dist/auth/infrastructure/google-identity-verifier');

function personal(options = {}) {
  const credentials = {
    id: 'integration-a',
    userId: 'user-a',
    googleSubject: 'subject-a',
    googleEmail: 'a@example.test',
    status: 'connected',
    encryptedRefreshToken: 'encrypted-refresh',
    rootFolderId: 'root',
    metadataJson: {},
  };
  const credentialQuery = {
    addSelect() {
      return this;
    },
    where() {
      return this;
    },
    innerJoin() {
      return this;
    },
    andWhere() {
      return this;
    },
    getOne: mock.fn(async () =>
      options.credentials === null ? null : credentials,
    ),
  };
  const integrations = {
    createQueryBuilder: () => credentialQuery,
    findOneBy: async () => credentials,
    update: mock.fn(async () => ({})),
    save: mock.fn(async (x) => x),
    create: (x) => x,
  };
  const files = options.files ?? {
    find: async () => [],
    update: mock.fn(async () => ({})),
  };
  const migrations = options.migrations ?? {};
  const legacy = {
    findOneBy: async () => ({ id: 'legacy', status: 'connected' }),
  };
  const tokens = {
    encrypt: (x) => 'encrypted-' + x,
    decrypt: (x) => x.replace('encrypted-', ''),
  };
  const verifier = {
    verify: async () => ({ subject: 'subject-a', email: 'a@example.test' }),
  };
  const provider = {
    findOrCreateFolder: async (_, name) => 'folder-' + name,
    getDrive: async () => options.drive,
  };
  const access = options.access ?? {
    assertPatientAccessible: async () => {},
    canManageClinical: () => true,
    canManagePatients: () => true,
    canViewAllPatients: () => false,
  };
  const service = new PersonalDriveStorage(
    integrations,
    {},
    files,
    migrations,
    legacy,
    tokens,
    verifier,
    provider,
    access,
  );
  service.drive = mock.fn(async () => options.drive);
  return { service, integrations, credentials };
}

test('uploads resolve the authenticated uploader, independently of clinic Drive', async () => {
  const personalUpload = mock.fn(async (input, userId) => ({
    storageProvider: 'google_drive',
    uploadedByUserId: userId,
  }));
  const memberships = {
    findOneBy: async ({ id, clinicId }) =>
      clinicId === 'clinic'
        ? { userId: id === 'membership-a' ? 'user-a' : 'user-b' }
        : null,
  };
  const service = new StorageService(
    memberships,
    {},
    { upload: personalUpload },
  );
  await assert.doesNotReject(
    service.upload({
      clinicId: 'clinic',
      uploadedByMembershipId: 'membership-a',
    }),
  );
  await assert.doesNotReject(
    service.upload({
      clinicId: 'clinic',
      uploadedByMembershipId: 'membership-b',
    }),
  );
  assert.equal(personalUpload.mock.calls[0].arguments[1], 'user-a');
  assert.equal(personalUpload.mock.calls[1].arguments[1], 'user-b');
  await assert.rejects(
    service.upload({
      clinicId: 'other-clinic',
      uploadedByMembershipId: 'membership-a',
    }),
  );
  assert.equal(personalUpload.mock.callCount(), 2);
});

test('disconnected users cannot upload and there is no local fallback', async () => {
  const { service } = personal({ credentials: null });
  await assert.rejects(
    service.upload({}, 'user-a'),
    (error) => error.getResponse().code === 'DRIVE_CONNECTION_REQUIRED',
  );
});

test('missing offline credentials cannot create a connected integration', async () => {
  const { service, credentials, integrations } = personal();
  credentials.encryptedRefreshToken = null;
  await assert.rejects(
    service.connect('user-a', {
      subject: 'subject-a',
      email: 'a@example.test',
      accessToken: 'access',
    }),
    (error) => error.getResponse().code === 'DRIVE_RECONNECT_REQUIRED',
  );
  assert.equal(integrations.save.mock.callCount(), 0);
});

test('a subsequent authorization preserves the refresh token and original integration ID', async () => {
  const drive = {
    files: { get: async () => ({ data: { id: 'root', trashed: false } }) },
  };
  const { service, credentials, integrations } = personal({ drive });
  await service.connect('user-a', {
    subject: 'subject-a',
    email: 'a@example.test',
    accessToken: 'new',
    scope: 'drive.file',
  });
  assert.equal(credentials.encryptedRefreshToken, 'encrypted-refresh');
  assert.equal(
    integrations.save.mock.calls[0].arguments[0].id,
    'integration-a',
  );
});

test('reconnection cannot move existing references to a different Google identity', async () => {
  const { service, integrations } = personal();
  await assert.rejects(
    service.connect('user-a', {
      subject: 'subject-b',
      accessToken: 'new',
      refreshToken: 'refresh',
    }),
    (error) => error.getResponse().code === 'DRIVE_ACCOUNT_MISMATCH',
  );
  assert.equal(integrations.save.mock.callCount(), 0);
});

test('private downloads use the file owner integration and return a stream', async () => {
  const drive = {
    files: {
      get: mock.fn(async () => ({ data: Readable.from(['private-content']) })),
    },
  };
  const { service } = personal({ drive });
  const stream = await service.download(
    { storageIntegrationId: 'integration-a', driveFileId: 'drive-file' },
    'clinic',
  );
  let text = '';
  for await (const chunk of stream) text += chunk;
  assert.equal(text, 'private-content');
  assert.deepEqual(drive.files.get.mock.calls[0].arguments[0], {
    fileId: 'drive-file',
    alt: 'media',
  });
});

test('legacy Drive downloads still resolve the existing clinic integration', async () => {
  const drive = {
    files: { get: async () => ({ data: Readable.from(['legacy-content']) }) },
  };
  const { service } = personal({ drive });
  const stream = await service.download(
    { storageIntegrationId: null, driveFileId: 'legacy-file' },
    'clinic',
  );
  let text = '';
  for await (const chunk of stream) text += chunk;
  assert.equal(text, 'legacy-content');
});

test('Drive revocation becomes a reconnect error rather than an app-session 401', async () => {
  const { service, credentials, integrations } = personal();
  await assert.rejects(
    service.withDrive(credentials, async () => {
      throw { response: { status: 401 } };
    }),
    (error) =>
      error.getStatus() === 409 &&
      error.getResponse().code === 'DRIVE_RECONNECT_REQUIRED',
  );
  assert.equal(integrations.update.mock.calls[0].arguments[1].status, 'error');
});

test('Drive quota/access failures are actionable without a storage fallback', async () => {
  const { service, credentials } = personal();
  await assert.rejects(
    service.withDrive(credentials, async () => {
      throw { response: { status: 403 } };
    }),
    (error) => error.getResponse().code === 'DRIVE_ACCESS_DENIED',
  );
});

test('disconnect clears credentials but does not trash Google files', async () => {
  const { service, integrations } = personal();
  await service.disconnect('user-a');
  assert.deepEqual(integrations.update.mock.calls[0].arguments, [
    { userId: 'user-a' },
    {
      status: 'disconnected',
      encryptedAccessToken: null,
      encryptedRefreshToken: null,
      tokenExpiresAt: null,
    },
  ]);
  assert.equal(service.drive.mock.callCount(), 0);
});

function migrationFixture(file, allow = true, failCommit = false) {
  const finishes = [];
  const itemQuery = {
    insert() {
      return this;
    },
    values() {
      return this;
    },
    orIgnore() {
      return this;
    },
    update() {
      return this;
    },
    set() {
      return this;
    },
    where() {
      return this;
    },
    andWhere() {
      return this;
    },
    execute: async () => ({ affected: 1 }),
  };
  const migrations = {
    createQueryBuilder: () => itemQuery,
    update: async (_, patch) => {
      finishes.push(patch);
    },
  };
  const updated = [];
  const fileQuery = {
    update() {
      return this;
    },
    set(patch) {
      updated.push(patch);
      return this;
    },
    setParameter() {
      return this;
    },
    where() {
      return this;
    },
    execute: async () => ({ affected: 1 }),
  };
  const photoUpdates = [];
  const manager = {
    getRepository(entity) {
      if (entity === PatientFile)
        return { createQueryBuilder: () => fileQuery };
      if (entity === Patient)
        return {
          update: async (...args) => {
            photoUpdates.push(args);
          },
        };
      if (entity === DriveMigrationItem) return migrations;
      throw new Error('Unknown repository');
    },
  };
  const files = {
    manager: { transaction: async (fn) => {
      if (failCommit) throw new Error("Database unavailable");
      return fn(manager);
    } },
    find: async () => [file],
  };
  const access = {
    assertPatientAccessible: async () => {
      if (!allow) throw new Error('Denied');
    },
    canManageClinical: () => true,
  };
  const { service } = personal({ files, migrations, access });
  service.migrationStatus = async () => ({ remaining: 0, hasMore: false });
  service.upload = mock.fn(async () => ({
    storageProvider: 'google_drive',
    storageIntegrationId: 'integration-a',
    driveFileId: 'uploaded',
    url: '/patient-files/file/download',
  }));
  return { service, finishes, updated, photoUpdates };
}

test('migration commits verified target references and avatar links before removing local source', async () => {
  const directory = path.resolve('uploads/patient-files');
  await fs.mkdir(directory, { recursive: true });
  const name = 'migration-test-' + Date.now();
  const source = path.join(directory, name);
  const bytes = Buffer.from('original');
  await fs.writeFile(source, bytes);
  const file = {
    id: 'file',
    patientId: 'patient',
    uploadedByUserId: 'user-a',
    uploadedByMembershipId: 'membership-a',
    storedName: name,
    storageProvider: 'local',
    type: 'image',
    originalName: 'xray.png',
    mimeType: 'image/png',
    checksum: createHash('sha256').update(bytes).digest('hex'),
    patient: { id: 'patient', clinic: { name: 'Clinic' } },
  };
  const { service, finishes, updated, photoUpdates } = migrationFixture(file);
  await service.migrate(
    'user-a',
    { clinicId: 'clinic', membershipId: 'membership-a', role: 'owner' },
    false,
  );
  assert.equal(updated[0].storageIntegrationId, 'integration-a');
  assert.equal(photoUpdates[0][0].profilePhotoFileId, 'file');
  assert.equal(finishes[0].status, 'complete');
  await assert.rejects(fs.access(source));
});

test('missing source files leave references intact and persist a retriable failure', async () => {
  const file = {
    id: 'missing',
    storedName: 'missing-source',
    patientId: 'patient',
    storageProvider: 'local',
  };
  const { service, finishes, updated } = migrationFixture(file);
  await service.migrate(
    'user-a',
    { clinicId: 'clinic', membershipId: 'membership-a', role: 'owner' },
    false,
  );
  assert.equal(finishes[0].status, 'failed');
  assert.equal(updated.length, 0);
  assert.equal(service.upload.mock.callCount(), 0);
});

test('migration checks current patient access before reading or uploading any content', async () => {
  const { service, finishes, updated } = migrationFixture(
    { id: 'file', patientId: 'patient' },
    false,
  );
  await service.migrate(
    'user-a',
    { clinicId: 'clinic', membershipId: 'membership-a', role: 'assistant' },
    false,
  );
  assert.equal(finishes[0].status, 'skipped');
  assert.equal(updated.length, 0);
  assert.equal(service.upload.mock.callCount(), 0);
});

test('Google verifier rejects unverified email, expired or invalid signed tokens', async () => {
  const old = process.env.GOOGLE_DRIVE_CLIENT_ID;
  process.env.GOOGLE_DRIVE_CLIENT_ID = 'server-test.apps.googleusercontent.com';
  try {
    const verifier = new GoogleTokenVerifier();
    verifier.client.verifyIdToken = async () => ({
      getPayload: () => ({
        sub: 'a',
        email: 'a@example.test',
        email_verified: false,
      }),
    });
    await assert.rejects(
      verifier.verify('token'),
      (error) => error.code === 'INVALID_GOOGLE_TOKEN',
    );
    verifier.client.verifyIdToken = async () => {
      throw new Error('Expired or invalid signature');
    };
    await assert.rejects(
      verifier.verify('token'),
      (error) => error.code === 'INVALID_GOOGLE_TOKEN',
    );
  } finally {
    if (old === undefined) delete process.env.GOOGLE_DRIVE_CLIENT_ID;
    else process.env.GOOGLE_DRIVE_CLIENT_ID = old;
  }
});


test('a failed migration database commit retains the local original for retry', async () => {
  const directory = path.resolve('uploads/patient-files');
  await fs.mkdir(directory, { recursive: true });
  const name = 'failed-commit-' + Date.now();
  const source = path.join(directory, name);
  await fs.writeFile(source, 'original');
  try {
    const { service, finishes, updated } = migrationFixture({
      id: 'file', patientId: 'patient', storedName: name, storageProvider: 'local',
      uploadedByMembershipId: 'member', originalName: 'file.txt', mimeType: 'text/plain',
      type: 'document', patient: { id: 'patient', clinic: { name: 'Clinic' } },
    }, true, true);
    await service.migrate('user-a', { clinicId: 'clinic', membershipId: 'member', role: 'owner' }, false);
    assert.equal(await fs.readFile(source, 'utf8'), 'original');
    assert.equal(finishes[0].status, 'failed');
    assert.equal(updated.length, 0);
  } finally { await fs.unlink(source); }
});

test('migration eligibility excludes unknown ownership and already migrated files', async () => {
  let query;
  const { service } = personal({ files: { find: async (options) => { query = options; return []; } } });
  await service.migrationCandidates('user-a', 'clinic-a');
  assert.equal(query.where.uploadedByUserId, 'user-a');
  assert.equal(query.where.patient.clinicId, 'clinic-a');
  assert.equal(query.where.storageStatus, 'available');
  assert.equal(query.where.storageIntegrationId.type, 'isNull');
});

test('retry reuses an existing app file only after validating its content', async () => {
  const directory = await fs.mkdtemp(path.join(require('node:os').tmpdir(), 'drive-verification-'));
  const source = path.join(directory, 'file');
  const bytes = Buffer.from('verified-content');
  await fs.writeFile(source, bytes);
  let metadata = { id: 'existing', name: 'file.txt', size: String(bytes.length), md5Checksum: createHash('md5').update(bytes).digest('hex') };
  const create = mock.fn(async () => { throw new Error('Must reuse the existing file'); });
  const drive = { files: { list: async () => ({ data: { files: [metadata] } }), create } };
  const { service } = personal({ drive });
  const input = { clinicId: 'clinic', clinicName: 'Clinic', patient: { id: 'patient', firstName: 'A', lastName: 'B' }, fileId: 'file', file: { path: source, originalname: 'file.txt', mimetype: 'text/plain' }, type: 'document', relation: {} };
  try {
    const result = await service.upload(input, 'user-a');
    assert.equal(result.driveFileId, 'existing');
    assert.equal(result.storageIntegrationId, 'integration-a');
    assert.equal(create.mock.callCount(), 0);
    metadata = { ...metadata, md5Checksum: 'wrong' };
    await assert.rejects(service.upload(input, 'user-a'), (error) => error.getResponse().code === 'DRIVE_UPLOAD_VERIFICATION_FAILED');
  } finally { await fs.rm(directory, { recursive: true }); }
});
