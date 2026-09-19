// Synthetic audit probes. Run with SPARK repository as the working directory.
// Reads/transpiles product code; never opens a real DB, file picker, or network.
const fs = require('node:fs');
const path = require('node:path');
const Module = require('node:module');
const assert = require('node:assert/strict');
const repoRoot = process.cwd();
const repoRequire = Module.createRequire(path.join(repoRoot, 'package.json'));
const ts = repoRequire('typescript');
const originalLoad = Module._load;
const originalTsExtension = require.extensions['.ts'];
let syntheticRaw = '';
let databaseCalls = 0;

Module._load = function (id, parent, isMain) {
  if (id.endsWith('/boundedBackupReader') || id === './boundedBackupReader') return { readBoundedBackup: async () => syntheticRaw };
  if (id === 'expo-file-system') {
    return {
      File: class {
        constructor() { this.size = Buffer.byteLength(syntheticRaw, 'utf8'); }
        async text() { return syntheticRaw; }
      },
      Paths: { cache: '/synthetic-audit-cache' },
    };
  }
  if (id === 'expo-document-picker') {
    return {
      getDocumentAsync: async () => ({
        canceled: false,
        assets: [{
          uri: 'file:///synthetic-audit.json',
          name: 'synthetic-audit.json',
          size: Buffer.byteLength(syntheticRaw, 'utf8'),
        }],
      }),
    };
  }
  if (id === 'expo-file-system/legacy' || id === 'expo-sharing') return {};
  if (id === 'react-native') return { Platform: { OS: 'android' } };
  if (id.endsWith('/db/database')) {
    return {
      getDatabase: async () => {
        databaseCalls += 1;
        throw new Error('Real database access is forbidden in this probe');
      },
    };
  }
  return originalLoad.call(this, id, parent, isMain);
};

require.extensions['.ts'] = function (mod, file) {
  const js = ts.transpileModule(fs.readFileSync(file, 'utf8'), {
    compilerOptions: {
      module: ts.ModuleKind.CommonJS,
      target: ts.ScriptTarget.ES2020,
    },
  }).outputText;
  mod._compile(js, file);
};

async function main() {
  const service = repoRequire('./src/services/backupService.ts');
  const payload = {
    version: 4,
    app: 'S.P.A.R.K.',
    exportedAt: '2026-09-15T00:00:00.000Z',
    range: { start: '2026-09-01', end: '2026-09-15' },
    data: {
      expenses: [], categories: [], budgets: [], debts: [], debt_payments: [],
      extra_incomes: [], recurring_payment_reminders: [], canonical_products: [],
      product_aliases: [],
      vendors: [{
        name: 'Synthetic audit vendor',
        logo_uri: 'https://example.invalid/unique-image.png',
        default_category_name: null,
      }],
    },
  };

  syntheticRaw = JSON.stringify(payload);
  const parsed = await service.pickAndParseBackupFile();
  const remoteLogoAccepted = parsed.payload.data.vendors[0].logo_uri ===
    payload.data.vendors[0].logo_uri;
  console.log('remote_logo_accepted:', remoteLogoAccepted);
  assert.equal(remoteLogoAccepted, false, 'Untrusted logo must be removed');

  syntheticRaw = syntheticRaw.slice(0, -1) + ',"unused":' +
    '{"x":'.repeat(20_000) + 'null' + '}'.repeat(20_000) + '}';
  let depthFailure = null;
  try {
    await service.pickAndParseBackupFile();
  } catch (error) {
    depthFailure = error;
  }
  console.log('deep_payload_bytes:', Buffer.byteLength(syntheticRaw, 'utf8'));
  console.log('deep_payload_failure:', depthFailure?.name ?? 'none');
  assert.equal(depthFailure?.message, 'INVALID_FORMAT', 'Deep JSON must fail in a controlled manner');
  assert.equal(databaseCalls, 0);
  console.log('database_calls:', databaseCalls);
  console.log('LIMITATION: Node validation only; no native Image request or device crash tested.');
  console.log('PASS: Both parser regressions prevented using synthetic data.');
}

main().catch(error => {
  // Print only the controlled failure type; no source paths or user data.
  console.error('Probe failed:', error?.name ?? 'UnknownError');
  process.exitCode = 1;
}).finally(() => {
  Module._load = originalLoad;
  if (originalTsExtension) require.extensions['.ts'] = originalTsExtension;
  else delete require.extensions['.ts'];
});
