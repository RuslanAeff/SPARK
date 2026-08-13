// S.P.A.R.K. — Borç vadesi / hatırlatma UI sözleşmesi
//
// Bu yardımcılar yalnız saf form ve sunum kurallarıdır. SQLite veya cihaz
// zamanlayıcısı hakkında varsayım yapmaz; YYYY-MM-DD değerleri lexicographic
// karşılaştırıldığı için saat diliminden bağımsızdır.
import { isSupportedYmd } from './inputValidation';

export const DEBT_REMINDER_PRESET_DAYS = [0, 1, 3, 7] as const;

export type DebtDueState = 'none' | 'upcoming' | 'today' | 'overdue';

export function getDebtDueState(
  dueDate: string | null | undefined,
  today: string,
): DebtDueState {
  if (!dueDate || !isSupportedYmd(dueDate) || !isSupportedYmd(today)) return 'none';
  if (dueDate === today) return 'today';
  return dueDate < today ? 'overdue' : 'upcoming';
}

export function parseDebtReminderDays(value: string): number | null {
  const trimmed = value.trim();
  if (!/^\d{1,3}$/.test(trimmed)) return null;
  const parsed = Number(trimmed);
  return Number.isInteger(parsed) && parsed >= 0 && parsed <= 365 ? parsed : null;
}

export function isValidDebtReminderTime(value: string): boolean {
  return /^(?:[01]\d|2[0-3]):[0-5]\d$/.test(value.trim());
}

