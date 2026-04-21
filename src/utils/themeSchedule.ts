// S.P.A.R.K. — Saate göre aydınlık / karanlık (sabit pencere)
import { Appearance } from 'react-native';
import { getDatabase } from '../db/database';
import { notifyThemeChanged } from '../theme/themeStore';

/** Gün ışığı: bu saatler arası aydınlık (dahil başlangıç, bitiş hariç) */
export const LIGHT_START_HOUR = 6; // 06:00
export const LIGHT_END_HOUR = 18; // 18:00 → 06:00’a kadar karanlık

const KEY_AUTO = 'auto_theme_schedule';
const KEY_MANUAL = 'theme_manual';

export function getScheduledColorScheme(): 'light' | 'dark' {
  const h = new Date().getHours();
  if (h >= LIGHT_START_HOUR && h < LIGHT_END_HOUR) return 'light';
  return 'dark';
}

/** Ayarlardan okuyup Appearance uygula (otomatik açıksa saat, kapalıysa manuel) */
export async function applyThemeFromDatabase(): Promise<void> {
  try {
    const db = await getDatabase();
    const auto = await db.getFirstAsync<{ value: string }>(
      `SELECT value FROM settings WHERE key = ?`,
      [KEY_AUTO]
    );
    if (auto?.value === '1') {
      Appearance.setColorScheme(getScheduledColorScheme());
      notifyThemeChanged();
      return;
    }
    const manual = await db.getFirstAsync<{ value: string }>(
      `SELECT value FROM settings WHERE key = ?`,
      [KEY_MANUAL]
    );
    const mode = manual?.value === 'light' || manual?.value === 'dark' ? manual.value : 'dark';
    Appearance.setColorScheme(mode);
    notifyThemeChanged();
  } catch (e) {
    console.warn('[themeSchedule] apply failed', e);
  }
}

export async function setAutoThemeSchedule(enabled: boolean): Promise<void> {
  const db = await getDatabase();
  await db.runAsync(
    `INSERT OR REPLACE INTO settings (key, value) VALUES (?, ?)`,
    [KEY_AUTO, enabled ? '1' : '0']
  );
  await applyThemeFromDatabase();
}

export async function setManualTheme(mode: 'light' | 'dark'): Promise<void> {
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
