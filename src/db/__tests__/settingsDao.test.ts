// CQ-03: ayar tablosuna tek erişim noktası.
jest.mock('../database', () => ({ getDatabase: jest.fn() }));

import { getDatabase } from '../database';
import { SettingsDao, type SettingsDb } from '../settingsDao';
import { CREATE_TABLES_SQL } from '../schema';
import { sqliteTestDatabase } from './helpers/sqliteTestDatabase';

let db: ReturnType<typeof sqliteTestDatabase>;

beforeEach(async () => {
  db = sqliteTestDatabase();
  (getDatabase as jest.Mock).mockResolvedValue(db);
  await db.execAsync(CREATE_TABLES_SQL);
});
afterEach(async () => db.close());

it('reads, overwrites and deletes plain values', async () => {
  expect(await SettingsDao.get('app_language')).toBeNull();
  await SettingsDao.set('app_language', 'az');
  await SettingsDao.set('app_language', 'ru');
  expect(await SettingsDao.get('app_language')).toBe('ru');
  await SettingsDao.delete('app_language');
  expect(await SettingsDao.get('app_language')).toBeNull();
});

it('round-trips JSON and returns null for corrupt JSON', async () => {
  await SettingsDao.setJson('analytics_card_order', { active: ['chart'], hidden: [] });
  expect(await SettingsDao.getJson('analytics_card_order')).toEqual({ active: ['chart'], hidden: [] });
  await SettingsDao.set('analytics_card_order', '{broken');
  expect(await SettingsDao.getJson('analytics_card_order')).toBeNull();
});

it('uses the given connection inside a transaction', async () => {
  (getDatabase as jest.Mock).mockClear();
  // Test yardımcısı gerçek bağlantı tipinin alt kümesidir.
  const conn = db as unknown as SettingsDb;
  await db.withTransactionAsync(async () => {
    await SettingsDao.set('backup_last_at', '1', conn);
  });
  expect(getDatabase).not.toHaveBeenCalled();
  expect(await SettingsDao.get('backup_last_at', conn)).toBe('1');
});

it('reads several keys in one query and skips missing ones', async () => {
  await SettingsDao.set('theme_manual', 'light');
  await SettingsDao.set('theme_accent', 'green');
  const values = await SettingsDao.getMany(['auto_theme_schedule', 'theme_manual', 'theme_accent']);
  expect(values.get('theme_manual')).toBe('light');
  expect(values.get('theme_accent')).toBe('green');
  expect(values.has('auto_theme_schedule')).toBe(false);
  expect((await SettingsDao.getMany([])).size).toBe(0);
});
