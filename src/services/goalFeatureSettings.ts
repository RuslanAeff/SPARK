// S.P.A.R.K. — Ana ekranda birikim hedefi / limit bloğunu göster
import { getDatabase } from '../db/database';

const KEY = 'goal_feature_enabled';

export async function getGoalFeatureEnabled(): Promise<boolean> {
  try {
    const db = await getDatabase();
    const row = await db.getFirstAsync<{ value: string }>(
      'SELECT value FROM settings WHERE key = ?',
      [KEY]
    );
    if (row?.value === '0') return false;
    return true;
  } catch {
    return true;
  }
}

export async function setGoalFeatureEnabled(enabled: boolean): Promise<void> {
  const db = await getDatabase();
  await db.runAsync(`INSERT OR REPLACE INTO settings (key, value) VALUES (?, ?)`, [
    KEY,
    enabled ? '1' : '0',
  ]);
}
