jest.mock('expo-secure-store', () => ({
  getItemAsync: jest.fn(), setItemAsync: jest.fn(), deleteItemAsync: jest.fn(),
}));
jest.mock('../../db/database', () => ({ getDatabase: jest.fn() }));
import * as store from 'expo-secure-store';
import { getDatabase } from '../../db/database';
import { deleteSecureApiKey, getSecureApiKey } from '../secureKeyStore';

let key: string | null;
let legacy: string | null;
const runAsync = jest.fn();
beforeEach(() => {
  jest.clearAllMocks();
  key = 'synthetic-key'; legacy = 'synthetic-legacy';
  (store.getItemAsync as jest.Mock).mockImplementation(async () => key);
  (store.setItemAsync as jest.Mock).mockImplementation(async (_name, value) => { key = value; });
  (store.deleteItemAsync as jest.Mock).mockImplementation(async () => { key = null; });
  runAsync.mockImplementation(async () => { legacy = null; });
  (getDatabase as jest.Mock).mockResolvedValue({
    getFirstAsync: async () => ({ value: legacy }), runAsync,
  });
});
it('propagates native failure and keeps the key readable', async () => {
  (store.deleteItemAsync as jest.Mock).mockRejectedValueOnce(new Error('synthetic failure'));
  await expect(deleteSecureApiKey()).rejects.toThrow('synthetic failure');
  expect(await getSecureApiKey()).toBe('synthetic-key');
});
it('propagates legacy removal failure before reporting success', async () => {
  runAsync.mockRejectedValueOnce(new Error('synthetic sqlite failure'));
  await expect(deleteSecureApiKey()).rejects.toThrow('synthetic sqlite failure');
  expect(store.deleteItemAsync).not.toHaveBeenCalled();
});
it('removes both stores and serializes a concurrent read', async () => {
  const reading = getSecureApiKey();
  const deleting = deleteSecureApiKey();
  await reading; await deleting;
  expect(key).toBeNull(); expect(legacy).toBeNull();
  expect(await getSecureApiKey()).toBeNull();
});
it('queue recovers after deletion failure', async () => {
  (store.deleteItemAsync as jest.Mock).mockRejectedValueOnce(new Error('failure'));
  await expect(deleteSecureApiKey()).rejects.toThrow();
  await deleteSecureApiKey();
  expect(await getSecureApiKey()).toBeNull();
});

it('deletion waits for in-flight migration and prevents restoration after module restart', async () => {
  let fresh!: typeof import('../secureKeyStore');
  jest.isolateModules(() => { fresh = require('../secureKeyStore'); });
  key = null;
  let resume!: (row: { value: string }) => void;
  let started!: () => void;
  const entered = new Promise<void>(resolve => { started = resolve; });
  const getFirstAsync = jest.fn(() => { started(); return new Promise(resolve => { resume = resolve; }); });
  (getDatabase as jest.Mock).mockResolvedValue({ getFirstAsync, runAsync });
  const reading = fresh.getSecureApiKey();
  await entered;
  const deleting = fresh.deleteSecureApiKey();
  expect(store.deleteItemAsync).not.toHaveBeenCalled();
  resume({ value: 'synthetic-legacy' });
  await reading;
  await deleting;
  expect(key).toBeNull(); expect(legacy).toBeNull();
  (getDatabase as jest.Mock).mockResolvedValue({ getFirstAsync: async () => ({ value: legacy }), runAsync });
  jest.isolateModules(() => { fresh = require('../secureKeyStore'); });
  expect(await fresh.getSecureApiKey()).toBeNull();
});
