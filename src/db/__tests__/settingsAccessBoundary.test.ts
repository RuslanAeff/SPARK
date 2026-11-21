// CQ-03: `settings` tablosuna SQL yalnız SettingsDao'da yazılır. İki bilinçli
// istisna: para birimi etiketleme alt sorgusu (tek UPDATE içinde okunur) ve
// yedek içe aktarımının kendi işlemi (ürün sahibi kararıyla dokunulmadı).
import fs from 'node:fs';
import path from 'node:path';

import { NOTIFICATION_STATE_KEYS, SETTINGS_KEYS } from '../settingsKeys';

const ROOT = path.resolve(__dirname, '../../..');
const ALLOWED = new Set([
  'src/db/settingsDao.ts',
  'src/db/appCurrencyDao.ts',
  'src/services/backupService.ts',
]);
const SETTINGS_SQL = /\b(FROM|INTO|UPDATE)\s+settings\b/;

function sourceFiles(dir: string): string[] {
  return fs.readdirSync(dir, { withFileTypes: true }).flatMap(entry => {
    const full = path.join(dir, entry.name);
    if (entry.isDirectory()) return entry.name === '__tests__' ? [] : sourceFiles(full);
    return /\.(ts|tsx)$/.test(entry.name) ? [full] : [];
  });
}

it('keeps settings SQL inside the settings DAO', () => {
  const offenders = ['app', 'src']
    .flatMap(dir => sourceFiles(path.join(ROOT, dir)))
    .map(file => path.relative(ROOT, file))
    .filter(file => !ALLOWED.has(file))
    .filter(file => SETTINGS_SQL.test(fs.readFileSync(path.join(ROOT, file), 'utf8')));
  expect(offenders).toEqual([]);
});

it('lists every key once', () => {
  const values = Object.values(SETTINGS_KEYS);
  expect(new Set(values).size).toBe(values.length);
  for (const key of NOTIFICATION_STATE_KEYS) expect(values).toContain(key);
});
