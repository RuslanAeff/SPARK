// S.P.A.R.K. — Bütçe döngüsü başlangıç günü ayarı
//
// Kullanıcının bütçe döngüsünü hangi günden başlatacağı (1–31) `settings`
// tablosunda saklanır. Varsayılan 1 → döngü takvim ayına eşittir (eski davranış).
// Saf matematik src/utils/budgetCycle.ts'de; bu dosya yalnızca kalıcılık katmanı.
import { getDatabase } from '../db/database';
import { DEFAULT_CYCLE_START_DAY, normalizeCycleStartDay } from '../utils/budgetCycle';

const KEY = 'budget_cycle_start_day';

export async function getCycleStartDay(): Promise<number> {
  try {
    const db = await getDatabase();
    const row = await db.getFirstAsync<{ value: string }>(
      'SELECT value FROM settings WHERE key = ?',
      [KEY],
    );
    if (row?.value) return normalizeCycleStartDay(row.value);
    return DEFAULT_CYCLE_START_DAY;
  } catch (e) {
    console.warn('[budgetCycle] load failed', e);
    return DEFAULT_CYCLE_START_DAY;
  }
}

export async function setCycleStartDay(day: number): Promise<void> {
  const db = await getDatabase();
  await db.runAsync('INSERT OR REPLACE INTO settings (key, value) VALUES (?, ?)', [
    KEY,
    String(normalizeCycleStartDay(day)),
  ]);
}
