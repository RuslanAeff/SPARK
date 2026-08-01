// S.P.A.R.K. — Saate göre aydınlık / karanlık (sabit pencere)
import { getDatabase } from '../db/database';
import { setAppThemeScheme } from '../theme/themeStore';

/** Gün ışığı: bu saatler arası aydınlık (dahil başlangıç, bitiş hariç) */
export const LIGHT_START_HOUR = 6; // 06:00
export const LIGHT_END_HOUR = 18; // 18:00 → 06:00’a kadar karanlık

const KEY_AUTO = 'auto_theme_schedule';
const KEY_MANUAL = 'theme_manual';
let applyGeneration = 0;

export function getScheduledColorScheme(): 'light' | 'dark' {
  const h = new Date().getHours();
  if (h >= LIGHT_START_HOUR && h < LIGHT_END_HOUR) return 'light';
  return 'dark';
}

/** Ayarlardan okuyup React tema store'una uygula (otomatikse saat, değilse manuel). */
export async function applyThemeFromDatabase(): Promise<void> {
  const generation = ++applyGeneration;
  try {
    const db = await getDatabase();
    const rows = await db.getAllAsync<{ key: string; value: string }>(
      `SELECT key, value FROM settings WHERE key IN (?, ?)`,
      [KEY_AUTO, KEY_MANUAL],
    );
    if (generation !== applyGeneration) return;

    const values = new Map(rows.map((row) => [row.key, row.value]));
    const manual = values.get(KEY_MANUAL);
    const next =
      values.get(KEY_AUTO) === '1'
        ? getScheduledColorScheme()
        : manual === 'light' || manual === 'dark'
          ? manual
          : 'dark';
    setAppThemeScheme(next);
  } catch (e) {
    console.warn('[themeSchedule] apply failed', e);
  }
}

export async function setAutoThemeSchedule(enabled: boolean): Promise<void> {
  // Başlamış eski scheduler okumalarını yazma tamamlanmadan geçersiz kıl.
  const generation = ++applyGeneration;
  const db = await getDatabase();
  await db.runAsync(
    `INSERT OR REPLACE INTO settings (key, value) VALUES (?, ?)`,
    [KEY_AUTO, enabled ? '1' : '0']
  );
  if (generation !== applyGeneration) return;
  if (enabled) {
    setAppThemeScheme(getScheduledColorScheme());
  } else {
    await applyThemeFromDatabase();
  }
}

export async function setManualTheme(mode: 'light' | 'dark'): Promise<void> {
  ++applyGeneration;
  const db = await getDatabase();
  await db.runAsync(
    `INSERT OR REPLACE INTO settings (key, value) VALUES (?, ?)`,
    [KEY_MANUAL, mode]
  );
  await applyThemeFromDatabase();
}

export async function loadThemeSettings(): Promise<{
  autoEnabled: boolean;
  manual: 'light' | 'dark';
}> {
  try {
    const db = await getDatabase();
    const auto = await db.getFirstAsync<{ value: string }>(
      `SELECT value FROM settings WHERE key = ?`,
      [KEY_AUTO]
    );
    const manual = await db.getFirstAsync<{ value: string }>(
      `SELECT value FROM settings WHERE key = ?`,
      [KEY_MANUAL]
    );
    return {
      autoEnabled: auto?.value === '1',
      manual: manual?.value === 'light' || manual?.value === 'dark' ? manual.value : 'dark',
    };
  } catch {
    return { autoEnabled: false, manual: 'dark' };
  }
}
