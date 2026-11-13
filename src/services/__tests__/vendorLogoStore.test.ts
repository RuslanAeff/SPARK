// BUG-27: satıcı logoları kalıcı klasörde; değişen/silinen logonun dosyası temizlenir.
const mockFiles = new Map<string, string>();
const mockDirs = new Set<string>();

jest.mock('expo-file-system/legacy', () => ({
  documentDirectory: 'file:///doc/',
  cacheDirectory: 'file:///cache/',
  makeDirectoryAsync: jest.fn(async (dir: string) => { mockDirs.add(dir); }),
  copyAsync: jest.fn(async ({ from, to }: { from: string; to: string }) => {
    if (!mockFiles.has(from)) throw new Error('missing source');
    mockFiles.set(to, mockFiles.get(from)!);
  }),
  deleteAsync: jest.fn(async (uri: string) => { mockFiles.delete(uri); }),
  getInfoAsync: jest.fn(async (uri: string) => ({ exists: mockFiles.has(uri) || mockDirs.has(uri) })),
  readDirectoryAsync: jest.fn(async (dir: string) => Array.from(mockFiles.keys())
    .filter(uri => uri.startsWith(dir) && !uri.slice(dir.length).includes('/'))
    .map(uri => uri.slice(dir.length))),
}));

const mockVendors: Array<{ id: number; logo_uri: string | null }> = [];
const mockDb = {
  getFirstAsync: jest.fn(async (_sql: string, params: number[]) => mockVendors.find(v => v.id === params[0]) ?? null),
  getAllAsync: jest.fn(async (sql: string) => mockVendors
    .filter(v => v.logo_uri != null)
    .map(v => (sql.includes('SELECT id,') ? { id: v.id, logo_uri: v.logo_uri } : { logo_uri: v.logo_uri }))),
  runAsync: jest.fn(async (sql: string, params: Array<string | number | null>) => {
    const id = params[params.length - 1] as number;
    const vendor = mockVendors.find(v => v.id === id);
    if (!vendor) return { changes: 0 };
    vendor.logo_uri = sql.includes('logo_uri = NULL') ? null : (params[0] as string | null);
    return { changes: 1 };
  }),
};
jest.mock('../../db/database', () => ({ getDatabase: jest.fn(async () => mockDb) }));

import * as FS from 'expo-file-system/legacy';
import {
  isOwnedLogoUri,
  maintainVendorLogos,
  migrateVendorLogos,
  setVendorLogo,
  sweepOrphanVendorLogos,
} from '../vendorLogoStore';

const LOGO_DIR = 'file:///doc/vendor-logos/';
const storedLogos = () => Array.from(mockFiles.keys()).filter(uri => uri.startsWith(LOGO_DIR));

beforeEach(() => {
  mockFiles.clear();
  mockDirs.clear();
  mockVendors.length = 0;
  jest.clearAllMocks();
});

describe('setVendorLogo', () => {
  it('copies the picked cache image into persistent storage and stores that path', async () => {
    mockVendors.push({ id: 7, logo_uri: null });
    mockFiles.set('file:///cache/ImagePicker/abc.png', 'png-bytes');

    const stored = await setVendorLogo(7, 'file:///cache/ImagePicker/abc.png');

    expect(stored.startsWith(LOGO_DIR)).toBe(true);
    expect(stored.endsWith('.png')).toBe(true);
    expect(isOwnedLogoUri(stored)).toBe(true);
    expect(mockVendors[0].logo_uri).toBe(stored);
    // Önbellek temizlense bile logo kalır.
    mockFiles.delete('file:///cache/ImagePicker/abc.png');
    expect(mockFiles.get(stored)).toBe('png-bytes');
  });

  it('removes the previous owned logo file when the logo changes', async () => {
    mockVendors.push({ id: 1, logo_uri: null });
    mockFiles.set('file:///cache/ImagePicker/a.jpg', 'a');
    mockFiles.set('file:///cache/ImagePicker/b.jpg', 'b');
    const first = await setVendorLogo(1, 'file:///cache/ImagePicker/a.jpg');
    const second = await setVendorLogo(1, 'file:///cache/ImagePicker/b.jpg');
    expect(second).not.toBe(first);
    expect(storedLogos()).toEqual([second]);
  });

  it('keeps the old logo and leaves no stray copy when the vendor no longer exists', async () => {
    mockFiles.set('file:///cache/ImagePicker/a.jpg', 'a');
    await expect(setVendorLogo(99, 'file:///cache/ImagePicker/a.jpg')).rejects.toThrow('VENDOR_NOT_FOUND');
    expect(storedLogos()).toEqual([]);
  });

  it('rejects non-local sources', async () => {
    mockVendors.push({ id: 1, logo_uri: null });
    await expect(setVendorLogo(1, 'https://example.com/logo.png')).rejects.toThrow('INVALID_LOGO_URI');
    expect(FS.copyAsync).not.toHaveBeenCalled();
  });
});

describe('sweepOrphanVendorLogos', () => {
  it('deletes only unreferenced files that this module created', async () => {
    const kept = `${LOGO_DIR}v1-100-aaaa.jpg`;
    const orphan = `${LOGO_DIR}v2-100-bbbb.jpg`;
    const foreign = `${LOGO_DIR}notes.txt`;
    mockDirs.add(LOGO_DIR);
    for (const uri of [kept, orphan, foreign]) mockFiles.set(uri, 'x');
    mockVendors.push({ id: 1, logo_uri: kept });

    expect(await sweepOrphanVendorLogos()).toBe(1);
    expect(mockFiles.has(kept)).toBe(true);
    expect(mockFiles.has(orphan)).toBe(false);
    expect(mockFiles.has(foreign)).toBe(true);
  });

  it('is a no-op when the logo folder does not exist yet', async () => {
    expect(await sweepOrphanVendorLogos()).toBe(0);
    expect(FS.readDirectoryAsync).not.toHaveBeenCalled();
  });
});

describe('migrateVendorLogos', () => {
  it('moves surviving cache logos, clears vanished ones and leaves gallery sources alone', async () => {
    mockFiles.set('file:///cache/ImagePicker/old.jpg', 'old');
    mockVendors.push(
      { id: 1, logo_uri: 'file:///cache/ImagePicker/old.jpg' },
      { id: 2, logo_uri: 'file:///cache/ImagePicker/evicted.jpg' },
      { id: 3, logo_uri: 'content://media/external/images/5' },
      { id: 4, logo_uri: 'javascript:alert(1)' },
    );

    expect(await migrateVendorLogos()).toBe(2);

    expect(isOwnedLogoUri(mockVendors[0].logo_uri)).toBe(true);
    expect(mockFiles.get(mockVendors[0].logo_uri!)).toBe('old');
    expect(mockVendors[1].logo_uri).toBeNull();
    expect(mockVendors[2].logo_uri).toBe('content://media/external/images/5');
    expect(mockVendors[3].logo_uri).toBe('javascript:alert(1)');
    // İkinci çalıştırma hiçbir şeyi değiştirmez.
    expect(await migrateVendorLogos()).toBe(0);
  });

  it('re-points our own file after the iOS container path changes', async () => {
    const current = `${LOGO_DIR}v1-100-aaaa.jpg`;
    mockFiles.set(current, 'x');
    mockVendors.push(
      { id: 1, logo_uri: 'file:///old-container/Documents/vendor-logos/v1-100-aaaa.jpg' },
      { id: 2, logo_uri: 'file:///old-container/Documents/vendor-logos/v2-100-gone.jpg' },
    );
    await migrateVendorLogos();
    expect(mockVendors[0].logo_uri).toBe(current);
    expect(mockVendors[1].logo_uri).toBeNull();
  });

  it('runs migration before the orphan sweep at startup', async () => {
    mockFiles.set('file:///cache/ImagePicker/old.jpg', 'old');
    mockVendors.push({ id: 1, logo_uri: 'file:///cache/ImagePicker/old.jpg' });
    await maintainVendorLogos();
    expect(storedLogos()).toEqual([mockVendors[0].logo_uri]);
  });
});
