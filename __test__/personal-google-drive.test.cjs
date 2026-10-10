// Run after building: node --test __test__/personal-google-drive.test.cjs
const { test, mock } = require('node:test');
const assert = require('node:assert/strict');
const { Readable } = require('node:stream');
const { createHash } = require('node:crypto');
const fs = require('node:fs/promises');
const path = require('node:path');
const { OAuth2Client } = require('google-auth-library');
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
} = require('../dist/storage/infrastructure/google-identity-verifier');

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
    count: async () => 0,
    findOne: async () => null,
    update: mock.fn(async () => ({})),
    save: mock.fn(async (x) => x),
    create: (x) => x,
  };
  const patients = options.patients ?? {};
  const migrations = options.migrations ?? {};
  const legacy = {
    findOneBy: async () => ({ id: 'legacy', status: 'connected' }),
  };
  const tokens = {
    encrypt: (x) => 'encrypted-' + x,
    decrypt: (x) => x.replace('encrypted-', ''),
  };
  const verifier = options.verifier ?? {
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
    files,
    patients,
    migrations,
    legacy,
    tokens,
    verifier,
    provider,
    access,
  );
  service.drive = mock.fn(async () => options.drive);
  return { service, integrations, credentials, files, patients };
}

async function withCodeExchange(tokens, action) {
  const originalGetToken = OAuth2Client.prototype.getToken;
  const originalClientId = process.env.GOOGLE_DRIVE_CLIENT_ID;
  const originalClientSecret = process.env.GOOGLE_DRIVE_CLIENT_SECRET;
  process.env.GOOGLE_DRIVE_CLIENT_ID = 'test-client-id';
  process.env.GOOGLE_DRIVE_CLIENT_SECRET = 'test-client-secret';
  OAuth2Client.prototype.getToken = async () => ({ tokens });
  try {
    await action();
  } finally {
    OAuth2Client.prototype.getToken = originalGetToken;
    if (originalClientId === undefined)
      delete process.env.GOOGLE_DRIVE_CLIENT_ID;
    else process.env.GOOGLE_DRIVE_CLIENT_ID = originalClientId;
    if (originalClientSecret === undefined)
      delete process.env.GOOGLE_DRIVE_CLIENT_SECRET;
    else process.env.GOOGLE_DRIVE_CLIENT_SECRET = originalClientSecret;
  }
}

test('uses the supplied ID token when code exchange omits one', async () => {
  await withCodeExchange(
    { access_token: 'access-token', refresh_token: 'refresh-token' },
    async () => {
      const verifiedTokens = [];
      const { service } = personal({
        verifier: {
          verify: async (idToken) => {
            verifiedTokens.push(idToken);
            return { subject: 'subject-a', email: 'a@example.test' };
          },
        },
      });
      const authorization = await service.exchangeCode(
        'server-code',
        'supplied-id-token',
      );
      assert.equal(authorization.subject, 'subject-a');
      assert.equal(authorization.accessToken, 'access-token');
      assert.deepEqual(verifiedTokens, ['supplied-id-token']);
    },
  );
});

test('supports older clients when code exchange returns an ID token', async () => {
  await withCodeExchange(
    {
      id_token: 'exchange-id-token',
      access_token: 'access-token',
      refresh_token: 'refresh-token',
    },
    async () => {
      const verifiedTokens = [];
      const { service } = personal({
        verifier: {
          verify: async (idToken) => {
            verifiedTokens.push(idToken);
            return { subject: 'subject-a', email: 'a@example.test' };
          },
        },
      });
      const authorization = await service.exchangeCode('server-code');
      assert.equal(authorization.subject, 'subject-a');
      assert.deepEqual(verifiedTokens, ['exchange-id-token']);
    },
  );
});

test('rejects an invalid supplied ID token', async () => {
  await withCodeExchange({ access_token: 'access-token' }, async () => {
    const { service } = personal({
      verifier: {
        verify: async () => {
          throw new Error('invalid ID token');
        },
      },
    });
    await assert.rejects(
      service.exchangeCode('server-code', 'invalid-id-token'),
      /invalid ID token/,
    );
  });
});

test('rejects mismatched supplied and exchanged ID-token identities', async () => {
  await withCodeExchange(
    {
      id_token: 'exchange-id-token',
      access_token: 'access-token',
    },
    async () => {
      const { service } = personal({
        verifier: {
          verify: async (idToken) => ({
            subject:
              idToken === 'supplied-id-token' ? 'subject-a' : 'subject-b',
            email: 'a@example.test',
          }),
        },
      });
      await assert.rejects(
        service.exchangeCode('server-code', 'supplied-id-token'),
        (error) => error.getResponse().code === 'DRIVE_ACCOUNT_MISMATCH',
      );
    },
  );
});

test('requires a usable access token and a verified identity', async () => {
  await withCodeExchange(
    { id_token: 'exchange-id-token', access_token: ' ' },
    async () => {
      const { service } = personal();
      await assert.rejects(
        service.exchangeCode('server-code'),
        (error) => error.getResponse().code === 'DRIVE_RECONNECT_REQUIRED',
      );
    },
  );
  await withCodeExchange({ access_token: 'access-token' }, async () => {
    const { service } = personal();
    await assert.rejects(
      service.exchangeCode('server-code'),
      (error) => error.getResponse().code === 'DRIVE_RECONNECT_REQUIRED',
    );
  });
});

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
    changes: {
      getStartPageToken: async () => ({ data: { startPageToken: 'next' } }),
    },
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

test('a DentalHub user can connect a Drive account with a different email', async () => {
  const drive = {
    files: {},
    changes: {
      getStartPageToken: async () => ({ data: { startPageToken: 'start' } }),
    },
  };
  const { service, integrations } = personal({ credentials: null, drive });
  await assert.doesNotReject(
    service.connect('user-a', {
      subject: 'google-drive-subject',
      email: 'different-google-account@example.test',
      accessToken: 'access',
      refreshToken: 'refresh',
      scope: 'https://www.googleapis.com/auth/drive.file',
    }),
  );
  assert.equal(
    integrations.save.mock.calls[0].arguments[0].googleEmail,
    'different-google-account@example.test',
  );
});

test('Picker import moves the selected Drive file into its patient folder', async () => {
  const historyMd5 = createHash('md5').update('history data').digest('hex');
  const source = {
    id: 'picked-file',
    name: 'history.txt',
    mimeType: 'text/plain',
    size: '12',
    parents: ['source-folder'],
    appProperties: { source: 'picker' },
    modifiedTime: '2026-10-07T12:00:00.000Z',
    md5Checksum: historyMd5,
  };
  const drive = {
    files: {
      get: mock.fn(async (params) =>
        params.alt === 'media'
          ? { data: Readable.from(['history data']) }
          : { data: source },
      ),
      update: mock.fn(async (params) => ({
        data: {
          id: 'picked-file',
          name: 'history.txt',
          mimeType: 'text/plain',
          size: '12',
          parents: [params.addParents],
          modifiedTime: '2026-10-07T12:01:00.000Z',
          md5Checksum: historyMd5,
        },
      })),
    },
  };
  const patients = {
    findOne: async () => ({ id: 'patient-a', clinic: { name: 'Clinic A' } }),
  };
  const { service } = personal({ drive, patients });
  const imported = await service.importFromDrive(
    {
      clinicId: 'clinic-a',
      clinicName: 'Clinic A',
      patientId: 'patient-a',
      patientFileId: 'patient-file-a',
      uploadedByMembershipId: 'membership-a',
      sourceDriveFileId: 'picked-file',
      type: 'document',
      relation: {},
    },
    'user-a',
  );
  assert.equal(imported.driveFileId, 'picked-file');
  assert.equal(imported.storageProvider, 'google_drive');
  assert.equal(imported.driveFolderId, 'folder-documents');
  assert.deepEqual(
    drive.files.update.mock.calls[0].arguments[0].requestBody.appProperties,
    {
      source: 'picker',
      fileId: 'patient-file-a',
      patientId: 'patient-a',
      tenantId: 'clinic-a',
      uploaderUserId: 'user-a',
      category: 'documents',
    },
  );
  assert.equal(
    drive.files.update.mock.calls[0].arguments[0].removeParents,
    'source-folder',
  );
});

test('Drive file edits update the patient record and retain the previous revision', async () => {
  const file = {
    id: 'patient-file-a',
    patientId: 'patient-a',
    storageIntegrationId: 'integration-a',
    driveFileId: 'drive-file-a',
    driveFolderId: 'category-folder',
    uploadedByUserId: 'user-a',
    storedName: 'old-xray.png',
    originalName: 'old-xray.png',
    description: null,
    type: 'radiography',
    size: 100,
    mimeType: 'image/png',
    storageStatus: 'available',
    syncReviewRequired: false,
    syncReviewReason: null,
    externalMetadataJson: {
      md5Checksum: 'old-md5',
      headRevisionId: 'old-revision',
    },
    driveModifiedAt: new Date('2026-10-07T12:00:00.000Z'),
  };
  const folderData = {
    'category-folder': {
      id: 'category-folder',
      name: 'radiographs',
      parents: ['patient-folder'],
    },
    'patient-folder': {
      id: 'patient-folder',
      name: 'patient-PAC-PATIEN__patien',
      parents: ['patients-folder'],
    },
    'patients-folder': {
      id: 'patients-folder',
      name: 'patients',
      parents: ['clinic-folder'],
    },
    'clinic-folder': {
      id: 'clinic-folder',
      name: 'DentalHub__tenant-clinic__clinic-a',
      parents: ['root'],
    },
  };
  const files = {
    findOne: async () => file,
    save: mock.fn(async (value) => value),
    create: (value) => value,
  };
  const patients = {
    findOneBy: async () => ({ id: 'patient-a', clinicId: 'clinic-a' }),
  };
  const drive = {
    files: {
      get: async ({ fileId }) => ({ data: folderData[fileId] }),
    },
  };
  const { service } = personal({ drive, files, patients });
  const result = await service.applyDriveChange(
    {
      id: 'integration-a',
      rootFolderId: 'root',
    },
    drive,
    {
      fileId: 'drive-file-a',
      file: {
        id: 'drive-file-a',
        name: 'new-xray.png',
        mimeType: 'image/png',
        size: '120',
        md5Checksum: 'new-md5',
        headRevisionId: 'new-revision',
        modifiedTime: '2026-10-07T12:01:00.000Z',
        parents: ['category-folder'],
        appProperties: {
          fileId: 'patient-file-a',
          patientId: 'patient-a',
          tenantId: 'clinic-a',
        },
      },
    },
  );
  assert.equal(result.updated, 1);
  const saved = files.save.mock.calls[0].arguments[0];
  assert.equal(saved.storedName, 'new-xray.png');
  assert.equal(saved.size, 120);
  assert.deepEqual(saved.externalMetadataJson.driveVersionHistory, [
    {
      revisionId: 'old-revision',
      md5Checksum: 'old-md5',
      modifiedAt: '2026-10-07T12:00:00.000Z',
      name: 'old-xray.png',
      size: 100,
    },
  ]);
  assert.equal(saved.externalMetadataJson.headRevisionId, 'new-revision');
});

test('clinic manual sync does not advance the shared account change cursor', async () => {
  const drive = {
    changes: {
      list: async () => ({
        data: { changes: [], newStartPageToken: 'new-cursor' },
      }),
    },
  };
  const { service, integrations, credentials } = personal({ drive });
  credentials.driveStartPageToken = 'existing-cursor';
  await service.sync('user-a', { clinicId: 'clinic-a' });
  assert.equal(
    integrations.save.mock.calls.at(-1).arguments[0].driveStartPageToken,
    'existing-cursor',
  );
});

test('app metadata edits update the same file in its managed Drive category', async () => {
  const drive = {
    files: {
      get: async () => ({
        data: {
          id: 'drive-file-a',
          name: 'old.png',
          mimeType: 'image/png',
          size: '100',
          md5Checksum: 'checksum',
          modifiedTime: '2026-10-07T12:00:00.000Z',
          parents: ['old-folder'],
          description: 'old description',
          appProperties: { fileId: 'patient-file-a' },
        },
      }),
      update: mock.fn(async (params) => ({
        data: {
          id: 'drive-file-a',
          name: params.requestBody.name,
          mimeType: 'image/png',
          size: '100',
          md5Checksum: 'checksum',
          modifiedTime: '2026-10-07T12:01:00.000Z',
          parents: [params.addParents],
          description: params.requestBody.description,
        },
      })),
    },
  };
  const { service } = personal({ drive });
  const result = await service.updateMetadata(
    {
      id: 'patient-file-a',
      patientId: 'patient-a',
      storageIntegrationId: 'integration-a',
      driveFileId: 'drive-file-a',
      driveModifiedAt: new Date('2026-10-07T12:00:00.000Z'),
      storedName: 'old.png',
      url: '/patient-files/patient-file-a/download',
      uploadedByUserId: 'user-a',
      type: 'image',
      externalMetadataJson: {},
    },
    {
      name: 'new.png',
      description: 'new description',
      type: 'radiography',
      clinicId: 'clinic-a',
      clinicName: 'Clinic A',
      patient: { id: 'patient-a' },
    },
  );
  const update = drive.files.update.mock.calls[0].arguments[0];
  assert.equal(result.storedName, 'new.png');
  assert.equal(update.requestBody.description, 'new description');
  assert.equal(update.requestBody.appProperties.category, 'radiographs');
  assert.equal(update.addParents, 'folder-radiographs');
  assert.equal(update.removeParents, 'old-folder');
});

test('Drive changes outside the managed patient tree are flagged and not synced', async () => {
  const file = {
    id: 'patient-file-a',
    patientId: 'patient-a',
    storageIntegrationId: 'integration-a',
    driveFileId: 'drive-file-a',
    driveFolderId: 'category-folder',
    storedName: 'xray.png',
    externalMetadataJson: {},
    storageStatus: 'available',
  };
  const files = {
    findOne: async () => file,
    save: mock.fn(async (value) => value),
    create: (value) => value,
  };
  const patients = {
    findOneBy: async () => ({ id: 'patient-a', clinicId: 'clinic-a' }),
  };
  const drive = {
    files: {
      get: async () => ({ data: { id: 'random-folder', name: 'My Drive' } }),
    },
  };
  const { service } = personal({ drive, files, patients });
  const result = await service.applyDriveChange(
    { id: 'integration-a', rootFolderId: 'root' },
    drive,
    {
      fileId: 'drive-file-a',
      file: {
        id: 'drive-file-a',
        name: 'renamed-outside.png',
        parents: ['random-folder'],
        appProperties: { fileId: 'patient-file-a', patientId: 'patient-a' },
      },
    },
  );
  assert.equal(result.updated, 0);
  assert.equal(
    files.save.mock.calls[0].arguments[0].storageStatus,
    'unavailable',
  );
  assert.equal(files.save.mock.calls[0].arguments[0].syncReviewRequired, true);
});

test('Drive-side deletion preserves the patient record for review', async () => {
  const file = {
    id: 'patient-file-a',
    patientId: 'patient-a',
    storageIntegrationId: 'integration-a',
    driveFileId: 'drive-file-a',
    storedName: 'xray.png',
    externalMetadataJson: { headRevisionId: 'revision-a' },
    storageStatus: 'available',
    syncSource: 'drive_update',
    syncReviewRequired: false,
  };
  const files = {
    findOne: async () => file,
    save: mock.fn(async (value) => value),
    create: (value) => value,
  };
  const { service } = personal({ files });
  await service.applyDriveChange(
    { id: 'integration-a', rootFolderId: 'root' },
    {},
    { fileId: 'drive-file-a', removed: true },
  );
  const saved = files.save.mock.calls[0].arguments[0];
  assert.equal(saved.storageStatus, 'unavailable');
  assert.equal(saved.syncReviewRequired, true);
  assert.equal(saved.syncReviewReason, 'drive_file_removed');
  assert.equal(
    saved.externalMetadataJson.syncAudit.at(-1).event,
    'drive_file_unavailable',
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

test('patient file owners can inspect and download retained Drive revisions', async () => {
  const revision = Readable.from(['previous-version']);
  const drive = {
    revisions: {
      list: mock.fn(async () => ({
        data: {
          revisions: [
            {
              id: 'revision-a',
              modifiedTime: '2026-10-07T12:00:00.000Z',
              size: '16',
            },
          ],
        },
      })),
      get: mock.fn(async () => ({ data: revision })),
    },
  };
  const { service } = personal({ drive });
  const file = {
    storageIntegrationId: 'integration-a',
    driveFileId: 'drive-file-a',
  };
  await assert.doesNotReject(service.listRevisions(file));
  assert.equal((await service.listRevisions(file))[0].id, 'revision-a');
  const stream = await service.downloadRevision(file, 'revision-a');
  let text = '';
  for await (const chunk of stream) text += chunk;
  assert.equal(text, 'previous-version');
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
      driveWatchChannelId: null,
      driveWatchResourceId: null,
      driveWatchTokenHash: null,
      driveWatchExpiresAt: null,
    },
  ]);
  assert.equal(service.drive.mock.callCount(), 0);
});

test('disconnect requires backup confirmation when patient attachments remain', async () => {
  const files = {
    count: async () => 2,
  };
  const { service, integrations } = personal({ files });
  await assert.rejects(
    service.disconnect('user-a'),
    (error) =>
      error.getResponse().code === 'DRIVE_FILES_BACKUP_CONFIRMATION_REQUIRED',
  );
  assert.equal(integrations.update.mock.callCount(), 0);
  await service.disconnect('user-a', true);
  assert.equal(integrations.update.mock.callCount(), 1);
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
    manager: {
      transaction: async (fn) => {
        if (failCommit) throw new Error('Database unavailable');
        return fn(manager);
      },
    },
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
    const { service, finishes, updated } = migrationFixture(
      {
        id: 'file',
        patientId: 'patient',
        storedName: name,
        storageProvider: 'local',
        uploadedByMembershipId: 'member',
        originalName: 'file.txt',
        mimeType: 'text/plain',
        type: 'document',
        patient: { id: 'patient', clinic: { name: 'Clinic' } },
      },
      true,
      true,
    );
    await service.migrate(
      'user-a',
      { clinicId: 'clinic', membershipId: 'member', role: 'owner' },
      false,
    );
    assert.equal(await fs.readFile(source, 'utf8'), 'original');
    assert.equal(finishes[0].status, 'failed');
    assert.equal(updated.length, 0);
  } finally {
    await fs.unlink(source);
  }
});

test('migration eligibility excludes unknown ownership and already migrated files', async () => {
  let query;
  const { service } = personal({
    files: {
      find: async (options) => {
        query = options;
        return [];
      },
    },
  });
  await service.migrationCandidates('user-a', 'clinic-a');
  assert.equal(query.where.uploadedByUserId, 'user-a');
  assert.equal(query.where.patient.clinicId, 'clinic-a');
  assert.equal(query.where.storageStatus, 'available');
  assert.equal(query.where.storageIntegrationId.type, 'isNull');
});

test('retry reuses an existing app file only after validating its content', async () => {
  const directory = await fs.mkdtemp(
    path.join(require('node:os').tmpdir(), 'drive-verification-'),
  );
  const source = path.join(directory, 'file');
  const bytes = Buffer.from('verified-content');
  await fs.writeFile(source, bytes);
  let metadata = {
    id: 'existing',
    name: 'file.txt',
    size: String(bytes.length),
    md5Checksum: createHash('md5').update(bytes).digest('hex'),
  };
  const create = mock.fn(async () => {
    throw new Error('Must reuse the existing file');
  });
  const drive = {
    files: { list: async () => ({ data: { files: [metadata] } }), create },
  };
  const { service } = personal({ drive });
  const input = {
    clinicId: 'clinic',
    clinicName: 'Clinic',
    patient: { id: 'patient', firstName: 'A', lastName: 'B' },
    fileId: 'file',
    file: { path: source, originalname: 'file.txt', mimetype: 'text/plain' },
    type: 'document',
    relation: {},
  };
  try {
    const result = await service.upload(input, 'user-a');
    assert.equal(result.driveFileId, 'existing');
    assert.equal(result.storageIntegrationId, 'integration-a');
    assert.equal(create.mock.callCount(), 0);
    metadata = { ...metadata, md5Checksum: 'wrong' };
    await assert.rejects(
      service.upload(input, 'user-a'),
      (error) =>
        error.getResponse().code === 'DRIVE_UPLOAD_VERIFICATION_FAILED',
    );
  } finally {
    await fs.rm(directory, { recursive: true });
  }
});
