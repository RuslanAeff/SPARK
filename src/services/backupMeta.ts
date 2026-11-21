// S.P.A.R.K. — Yedekleme metaverisi (settings tablosu üzerinden)
// "Son yedek ne zaman alındı? Kaç işlem içeriyordu? Kullanıcı hatırlatma istiyor mu?"
// gibi bilgileri tutar. Bildirim motoru ve BackupSection bu helper'ı kullanır.
import { getDatabase } from '../db/database';
import { SettingsDao } from '../db/settingsDao';
import { SETTINGS_KEYS, type SettingKey } from '../db/settingsKeys';

const K_LAST_AT = SETTINGS_KEYS.backupLastAt;
const K_LAST_COUNT = SETTINGS_KEYS.backupLastCount;
const K_LAST_ITEM_COUNT = SETTINGS_KEYS.backupLastItemCount;
const K_LAST_RANGE_START = SETTINGS_KEYS.backupLastRangeStart;
const K_LAST_RANGE_END = SETTINGS_KEYS.backupLastRangeEnd;
const K_REMIND_INTERVAL = SETTINGS_KEYS.backupReminderInterval;
/**
 * Son TAM yedeğin zamanı (BUG-31): yalnız bütün verileri kapsayan dışa aktarım
 * yedek hatırlatıcısını sıfırlar; tek aylık bir dosya tam yedek sayılmaz.
 * Anahtar hiç yazılmamışsa (güncelleme öncesi yedekler) `backup_last_at` geçerli;
 * '' değeri "henüz tam yedek yok" demektir.
 */
const K_LAST_FULL_AT = SETTINGS_KEYS.backupLastFullAt;

/** "off" → hatırlatma yok. Sayısal değerler gün cinsindendir. */
export type BackupReminderInterval = 'off' | 'weekly' | 'monthly';

export const BACKUP_REMINDER_DAYS: Record<BackupReminderInterval, number> = {
  off: 0,
  weekly: 7,
  monthly: 30,
};

export interface BackupMeta {
  lastAt: number | null;
  /** Hatırlatıcı bunu kullanır; kısmi yedek bunu değiştirmez. */
  lastFullAt: number | null;
  lastCount: number | null;
  lastItemCount: number | null;
  lastRangeStart: string | null;
  lastRangeEnd: string | null;
  reminderInterval: BackupReminderInterval;
}

// CQ-03: ortak ayar DAO'su (eskiden bu dosyada kopyası vardı).
const getSetting = (key: SettingKey) => SettingsDao.get(key);
const setSetting = (key: SettingKey, value: string) => SettingsDao.set(key, value);

function parseIntSafe(raw: string | null): number | null {
  if (raw == null) return null;
  const n = Number(raw);
  return Number.isFinite(n) ? n : null;
}

export async function loadBackupMeta(): Promise<BackupMeta> {
  // ADR-002: aynı bağlantıda paralel sorgu yok; okumalar sırayla (BUG-12).
  const at = await getSetting(K_LAST_AT);
  const count = await getSetting(K_LAST_COUNT);
  const items = await getSetting(K_LAST_ITEM_COUNT);
  const rs = await getSetting(K_LAST_RANGE_START);
  const re = await getSetting(K_LAST_RANGE_END);
  const interval = await getSetting(K_REMIND_INTERVAL);
  const full = await getSetting(K_LAST_FULL_AT);
  const safeInterval: BackupReminderInterval =
    interval === 'weekly' || interval === 'monthly' ? interval : 'off';
  return {
    lastAt: parseIntSafe(at),
    lastFullAt: full == null ? parseIntSafe(at) : full === '' ? null : parseIntSafe(full),
    lastCount: parseIntSafe(count),
    lastItemCount: parseIntSafe(items),
    lastRangeStart: rs,
    lastRangeEnd: re,
    reminderInterval: safeInterval,
  };
}

/** Başarılı bir export sonrası çağrılır. */
export async function recordBackupSuccess(args: {
  expenseCount: number;
  itemCount: number;
  rangeStart: string;
  rangeEnd: string;
  /** Aralık bütün verileri kapsıyor mu (BackupSection, getAllDataRange ile). */
  fullRange: boolean;
}): Promise<void> {
  const now = Date.now();
  const entries: Array<[SettingKey, string]> = [
    [K_LAST_AT, String(now)],
    [K_LAST_COUNT, String(args.expenseCount)],
    [K_LAST_ITEM_COUNT, String(args.itemCount)],
    [K_LAST_RANGE_START, args.rangeStart],
    [K_LAST_RANGE_END, args.rangeEnd],
  ];
  // Beş anahtar tek transaction'da: "son yedek" kartı yarım bilgi göstermez (BUG-12).
  const db = await getDatabase();
  await db.withTransactionAsync(async () => {
    if (args.fullRange) {
      entries.push([K_LAST_FULL_AT, String(now)]);
    } else {
      // Güncelleme öncesi son yedek, ilk kısmi yedekte "tam" zamanı olarak
      // dondurulur; kısmi yedek hatırlatıcıyı ileri itmez.
      const existingFull = await SettingsDao.get(K_LAST_FULL_AT, db);
      // Satır yokluğu ile '' ("henüz tam yedek yok") ayrı anlamlar taşır.
      if (existingFull === null) {
        const previous = await SettingsDao.get(K_LAST_AT, db);
        entries.push([K_LAST_FULL_AT, previous ?? '']);
      }
    }
    for (const [key, value] of entries) {
      await SettingsDao.set(key, value, db);
    }
  });
}

export async function setBackupReminderInterval(
  next: BackupReminderInterval
): Promise<void> {
  await setSetting(K_REMIND_INTERVAL, next);
}

/** Hatırlatma açık mı + son yedeğin üzerinden N gün geçmiş mi? */
export function isBackupOverdue(meta: BackupMeta, now: number = Date.now()): boolean {
  if (meta.reminderInterval === 'off') return false;
  if (meta.lastFullAt == null) {
    // Hiç tam yedek alınmamış — kullanıcı hatırlatmayı seçtiyse hemen göster.
    return true;
  }
  const days = BACKUP_REMINDER_DAYS[meta.reminderInterval];
  const elapsed = (now - meta.lastFullAt) / (86400 * 1000);
  return elapsed >= days;
}
