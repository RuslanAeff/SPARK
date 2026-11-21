// S.P.A.R.K. — Bütçe döngüsü başlangıç günü ayarı
//
// Kullanıcının bütçe döngüsünü hangi günden başlatacağı (1–31) `settings`
// tablosunda saklanır. Varsayılan 1 → döngü takvim ayına eşittir (eski davranış).
// Saf matematik src/utils/budgetCycle.ts'de; bu dosya yalnızca kalıcılık katmanı.
import { SettingsDao } from '../db/settingsDao';
import { SETTINGS_KEYS } from '../db/settingsKeys';
import { DEFAULT_CYCLE_START_DAY, normalizeCycleStartDay } from '../utils/budgetCycle';
import { logError } from '../utils/logError';

const KEY = SETTINGS_KEYS.budgetCycleStartDay;

export async function getCycleStartDay(): Promise<number> {
  try {
    const value = await SettingsDao.get(KEY);
    if (value) return normalizeCycleStartDay(value);
    return DEFAULT_CYCLE_START_DAY;
  } catch (e) {
    logError('budgetCycle load failed', e);
    return DEFAULT_CYCLE_START_DAY;
  }
}
