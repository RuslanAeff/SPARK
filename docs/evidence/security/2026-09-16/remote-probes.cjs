// Read-only security regression probes. Run from the SPARK repository root:
// node docs/evidence/security/2026-09-16/remote-probes.cjs
// Loads product source into an isolated VM; native storage/images are synthetic.
// Expected secure behavior: failed deletion rejects; late temporary image is deleted.
const fs = require('node:fs');
const path = require('node:path');
const vm = require('node:vm');
const assert = require('node:assert/strict');
const ts = require(require.resolve('typescript', { paths: [process.cwd()] }));

function loadTs(relativePath, dependencies) {
  const exports = {};
  const source = fs.readFileSync(path.join(process.cwd(), relativePath), 'utf8');
  const code = ts.transpileModule(source, {
    compilerOptions: { module: ts.ModuleKind.CommonJS, target: ts.ScriptTarget.ES2020 },
  }).outputText;
  vm.runInNewContext(code, {
    exports,
    require: (name) => {
      if (!(name in dependencies)) throw new Error(`Unexpected dependency: ${name}`);
      return dependencies[name];
    },
    __DEV__: false,
    console,
    setTimeout,
    clearTimeout,
    AbortController,
  }, { filename: relativePath });
  return exports;
}

async function probeDeletionFailure() {
  let stored = 'synthetic-key-for-audit';
  const store = loadTs('src/services/secureKeyStore.ts', {
    'expo-secure-store': {
      getItemAsync: async () => stored,
      setItemAsync: async (_, value) => { stored = value; },
      deleteItemAsync: async () => { throw new Error('synthetic storage failure'); },
    },
    '../db/database': {
      getDatabase: async () => ({
        getFirstAsync: async () => null,
        runAsync: async () => ({ changes: 0 }),
      }),
    },
  });
  let rejected = false;
  try { await store.deleteSecureApiKey(); }
  catch { rejected = true; }
  const keyStillPresent = Boolean(await store.getSecureApiKey());
  console.log(JSON.stringify({ probe: 'secure-delete-fault', rejected, keyStillPresent }));
  assert.ok(rejected, 'Deletion failure must propagate instead of being reported as success');
}

async function probeLateImageCleanup() {
  const removed = [];
  let completeManipulation;
  const manipulation = new Promise((resolve) => { completeManipulation = resolve; });
  const compressor = loadTs('src/utils/imageCompressor.ts', {
    'expo-image-manipulator': {
      SaveFormat: { JPEG: 'jpeg' },
      manipulateAsync: () => manipulation,
    },
    'expo-file-system/legacy': {
      readAsStringAsync: async () => 'synthetic-image-bytes',
      deleteAsync: async (uri) => { removed.push(uri); },
    },
  });
  let timeoutCaught = false;
  try {
    await compressor.compressImageToBase64('file://synthetic-input.jpg', { timeoutMs: 1 });
  } catch (error) {
    timeoutCaught = error.message === 'IMAGE_PROCESSING_TIMEOUT';
  }
  // Complete the native operation only after the public operation timed out.
  completeManipulation({ uri: 'file://synthetic-cache/late.jpg' });
  await new Promise((resolve) => setTimeout(resolve, 0));
  console.log(JSON.stringify({
    probe: 'late-image-completion', timeoutCaught, cleanupCalls: removed.length,
  }));
  assert.ok(timeoutCaught, 'Probe must actually exercise the timeout path');
  assert.ok(removed.includes('file://synthetic-cache/late.jpg'), 'Late native output must be cleaned up');
}

(async () => {
  let failed = 0;
  for (const probe of [probeDeletionFailure, probeLateImageCleanup]) {
    try { await probe(); }
    catch (error) {
      failed += 1;
      console.error(`FAIL ${probe.name}: ${error.message}`);
    }
  }
  console.log(`Security probes: ${2 - failed} passed, ${failed} failed`);
  process.exitCode = failed === 0 ? 0 : 1;
})().catch(() => {
  console.error('Unexpected security probe harness failure');
  process.exitCode = 2;
});
