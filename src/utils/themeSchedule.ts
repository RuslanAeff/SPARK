// S.P.A.R.K. — Saate göre aydınlık / karanlık (sabit pencere)
import { SettingsDao } from '../db/settingsDao';
import { SETTINGS_KEYS } from '../db/settingsKeys';
import {
  setAppThemeAccent,
  setAppThemeScheme,
  setAppThemeSelection,
} from '../theme/themeStore';
import {
  DEFAULT_THEME_ACCENT,
  normalizeThemeAccent,
  type ThemeAccent,
} from '../theme/colors';
import { logError } from './logError';

/** Gün ışığı: bu saatler arası aydınlık (dahil başlangıç, bitiş hariç) */
export const LIGHT_START_HOUR = 6; // 06:00
export const LIGHT_END_HOUR = 18; // 18:00 → 06:00’a kadar karanlık

const KEY_AUTO = SETTINGS_KEYS.themeAutoSchedule;
const KEY_MANUAL = SETTINGS_KEYS.themeManual;
export const KEY_THEME_ACCENT = SETTINGS_KEYS.themeAccent;
const THEME_KEYS = [KEY_AUTO, KEY_MANUAL, KEY_THEME_ACCENT] as const;
let applyGeneration = 0;
let accentGeneration = 0;
let accentWriteQueue: Promise<void> = Promise.resolve();

export function getScheduledColorScheme(): 'light' | 'dark' {
  const h = new Date().getHours();
  if (h >= LIGHT_START_HOUR && h < LIGHT_END_HOUR) return 'light';
  return 'dark';
}

/** Ayarlardan okuyup React tema store'una uygula (otomatikse saat, değilse manuel). */
export async function applyThemeFromDatabase(): Promise<void> {
  const generation = ++applyGeneration;
  try {
    const values = await SettingsDao.getMany(THEME_KEYS);
    if (generation !== applyGeneration) return;

    const manual = values.get(KEY_MANUAL);
    const next =
      values.get(KEY_AUTO) === '1'
        ? getScheduledColorScheme()
        : manual === 'light' || manual === 'dark'
          ? manual
          : 'dark';
    setAppThemeSelection({
      scheme: next,
      accent: normalizeThemeAccent(values.get(KEY_THEME_ACCENT)),
    });
  } catch (e) {
    logError('themeSchedule apply failed', e);
  }
}

export async function setAutoThemeSchedule(enabled: boolean): Promise<void> {
  // Başlamış eski scheduler okumalarını yazma tamamlanmadan geçersiz kıl.
  const generation = ++applyGeneration;
  await SettingsDao.set(KEY_AUTO, enabled ? '1' : '0');
  if (generation !== applyGeneration) return;
  if (enabled) {
    setAppThemeScheme(getScheduledColorScheme());
  } else {
    await applyThemeFromDatabase();
  }
}

export async function setManualTheme(mode: 'light' | 'dark'): Promise<void> {
  ++applyGeneration;
  await SettingsDao.set(KEY_MANUAL, mode);
  await applyThemeFromDatabase();
}

/**
 * Vurgu yazmaları çağrı sırasıyla serileştirilir. Daha eski bir SQLite yazması
 * geç bitse bile son kullanıcı seçimi hem diskte hem store'da son değer olur.
 * Başarısız yazma UI'ı değiştirmez; kuyruk sonraki seçimler için açık kalır.
 */
export async function setThemeAccent(accent: ThemeAccent): Promise<void> {
  const normalized = normalizeThemeAccent(accent);
  // Başlamış bir DB snapshot'ının eski accent'i sonradan yayınlamasını engelle.
  ++applyGeneration;
  const generation = ++accentGeneration;

  const operation = accentWriteQueue.then(async () => {
    await SettingsDao.set(KEY_THEME_ACCENT, normalized);
  });
  accentWriteQueue = operation.catch(() => undefined);

  await operation;
  if (generation !== accentGeneration) return;
  setAppThemeAccent(normalized);
}

export async function loadThemeSettings(): Promise<{
  autoEnabled: boolean;
  manual: 'light' | 'dark';
  accent: ThemeAccent;
}> {
  try {
    const values = await SettingsDao.getMany(THEME_KEYS);
    const manual = values.get(KEY_MANUAL);
    return {
      autoEnabled: values.get(KEY_AUTO) === '1',
      manual: manual === 'light' || manual === 'dark' ? manual : 'dark',
      accent: normalizeThemeAccent(values.get(KEY_THEME_ACCENT)),
    };
  } catch {
    return { autoEnabled: false, manual: 'dark', accent: DEFAULT_THEME_ACCENT };
  }
}
