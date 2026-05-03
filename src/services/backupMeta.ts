// S.P.A.R.K. — Yedekleme metaverisi (settings tablosu üzerinden)
// "Son yedek ne zaman alındı? Kaç işlem içeriyordu? Kullanıcı hatırlatma istiyor mu?"
// gibi bilgileri tutar. Bildirim motoru ve BackupSection bu helper'ı kullanır.
import { getDatabase } from '../db/database';

const K_LAST_AT = 'backup_last_at';
const K_LAST_COUNT = 'backup_last_count';
const K_LAST_ITEM_COUNT = 'backup_last_item_count';
const K_LAST_RANGE_START = 'backup_last_range_start';
const K_LAST_RANGE_END = 'backup_last_range_end';
const K_REMIND_INTERVAL = 'backup_reminder_interval';

/** "off" → hatırlatma yok. Sayısal değerler gün cinsindendir. */
export type BackupReminderInterval = 'off' | 'weekly' | 'monthly';

export const BACKUP_REMINDER_DAYS: Record<BackupReminderInterval, number> = {
  off: 0,
  weekly: 7,
  monthly: 30,
};

export interface BackupMeta {
  lastAt: number | null;
  lastCount: number | null;
  lastItemCount: number | null;
  lastRangeStart: string | null;
  lastRangeEnd: string | null;
  reminderInterval: BackupReminderInterval;
}

async function getSetting(key: string): Promise<string | null> {
  const db = await getDatabase();
  const row = await db.getFirstAsync<{ value: string }>(
    'SELECT value FROM settings WHERE key = ?',
    [key]
  );
  return row?.value ?? null;
}

async function setSetting(key: string, value: string): Promise<void> {
  const db = await getDatabase();
  await db.runAsync('INSERT OR REPLACE INTO settings (key, value) VALUES (?, ?)', [
    key,
    value,
  ]);
}

function parseIntSafe(raw: string | null): number | null {
  if (raw == null) return null;
  const n = Number(raw);
  return Number.isFinite(n) ? n : null;
}

export async function loadBackupMeta(): Promise<BackupMeta> {
  const [at, count, items, rs, re, interval] = await Promise.all([
    getSetting(K_LAST_AT),
    getSetting(K_LAST_COUNT),
    getSetting(K_LAST_ITEM_COUNT),
    getSetting(K_LAST_RANGE_START),
    getSetting(K_LAST_RANGE_END),
    getSetting(K_REMIND_INTERVAL),
  ]);
  const safeInterval: BackupReminderInterval =
    interval === 'weekly' || interval === 'monthly' ? interval : 'off';
  return {
    lastAt: parseIntSafe(at),
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
}): Promise<void> {
  const now = Date.now();
  await Promise.all([
    setSetting(K_LAST_AT, String(now)),
    setSetting(K_LAST_COUNT, String(args.expenseCount)),
    setSetting(K_LAST_ITEM_COUNT, String(args.itemCount)),
    setSetting(K_LAST_RANGE_START, args.rangeStart),
    setSetting(K_LAST_RANGE_END, args.rangeEnd),
  ]);
}

export async function setBackupReminderInterval(
  next: BackupReminderInterval
): Promise<void> {
  await setSetting(K_REMIND_INTERVAL, next);
}

/** Hatırlatma açık mı + son yedeğin üzerinden N gün geçmiş mi? */
export function isBackupOverdue(meta: BackupMeta, now: number = Date.now()): boolean {
  if (meta.reminderInterval === 'off') return false;
  if (meta.lastAt == null) {
    // Hiç yedek alınmamış — kullanıcı hatırlatmayı seçtiyse hemen göster.
    return true;
  }
  const days = BACKUP_REMINDER_DAYS[meta.reminderInterval];
  const elapsed = (now - meta.lastAt) / (86400 * 1000);
  return elapsed >= days;
}
