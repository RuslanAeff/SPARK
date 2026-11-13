// BUG-31: yalnız bütün verileri kapsayan yedek, yedek hatırlatıcısını sıfırlar.
jest.mock('../../db/database', () => ({ getDatabase: jest.fn() }));

import { getDatabase } from '../../db/database';
import { sqliteTestDatabase } from '../../db/__tests__/helpers/sqliteTestDatabase';
import { isBackupOverdue, loadBackupMeta, recordBackupSuccess } from '../backupMeta';

let db: ReturnType<typeof sqliteTestDatabase>;
const DAY = 86400000;
const range = { expenseCount: 1, itemCount: 0, rangeStart: '2026-11-01', rangeEnd: '2026-11-13' };

beforeEach(async () => {
  db = sqliteTestDatabase();
  (getDatabase as jest.Mock).mockResolvedValue(db);
  await db.execAsync(`
    CREATE TABLE settings (key TEXT PRIMARY KEY, value TEXT NOT NULL);
    INSERT INTO settings (key, value) VALUES ('backup_reminder_interval', 'weekly');
  `);
});
afterEach(async () => {
  jest.restoreAllMocks();
  await db.close();
});

describe('yedek hatırlatıcısı ve tam yedek (BUG-31)', () => {
  it('kısmi yedek "son yedek" kartını günceller ama hatırlatıcıyı sıfırlamaz', async () => {
    jest.spyOn(Date, 'now').mockReturnValue(Date.UTC(2026, 10, 1));
    await recordBackupSuccess({ ...range, fullRange: true });
    jest.spyOn(Date, 'now').mockReturnValue(Date.UTC(2026, 10, 9));
    await recordBackupSuccess({ ...range, fullRange: false });

    const meta = await loadBackupMeta();
    expect(meta.lastAt).toBe(Date.UTC(2026, 10, 9));
    expect(meta.lastFullAt).toBe(Date.UTC(2026, 10, 1));
    expect(isBackupOverdue(meta, Date.UTC(2026, 10, 9))).toBe(true);

    jest.spyOn(Date, 'now').mockReturnValue(Date.UTC(2026, 10, 10));
    await recordBackupSuccess({ ...range, fullRange: true });
    expect(isBackupOverdue(await loadBackupMeta(), Date.UTC(2026, 10, 10) + DAY)).toBe(false);
  });

  it('güncelleme öncesi son yedek bir kez tam sayılır; sonraki kısmi yedek onu ileri itmez', async () => {
    const legacy = Date.UTC(2026, 10, 5);
    await db.runAsync("INSERT INTO settings (key, value) VALUES ('backup_last_at', ?)", [String(legacy)]);
    expect((await loadBackupMeta()).lastFullAt).toBe(legacy);

    jest.spyOn(Date, 'now').mockReturnValue(Date.UTC(2026, 10, 13));
    await recordBackupSuccess({ ...range, fullRange: false });
    expect((await loadBackupMeta()).lastFullAt).toBe(legacy);
  });

  it('hiç tam yedek yokken alınan kısmi yedek hatırlatıcıyı susturmaz', async () => {
    jest.spyOn(Date, 'now').mockReturnValue(Date.UTC(2026, 10, 13));
    await recordBackupSuccess({ ...range, fullRange: false });
    const meta = await loadBackupMeta();
    expect(meta.lastAt).toBe(Date.UTC(2026, 10, 13));
    expect(meta.lastFullAt).toBeNull();
    expect(isBackupOverdue(meta, Date.UTC(2026, 10, 13))).toBe(true);
  });
});
