// S.P.A.R.K. — Geleceğe tarihli Android hatırlatıcıları için saf plan üretimi.
//
// Bu modül DB, kalıcı ledger veya Expo bildirim API'sine dokunmaz. Cihazın
// yerel takviminde oluşacak tek-seferlik alarmları üretir; çağıran servis bu
// planı OS tarafındaki gerçek durumla uzlaştırır.

import type { Debt, RecurringPaymentReminder } from '../db/schema';
import { normalizeCanonicalUuid } from '../utils/inputValidation';
import {
  getNextOccurrence,
  isRecurringOccurrence,
  isValidYmd,
  shiftCalendarDate,
  type RecurringSchedule,
} from '../utils/recurringSchedule';

const HH_MM_PATTERN = /^(?:[01]\d|2[0-3]):[0-5]\d$/;
const SUPPORTED_UNITS = new Set(['day', 'week', 'month', 'year']);

export const MAX_NATIVE_REMINDER_SCHEDULES = 512;
export const RECURRING_REMINDER_HORIZON_DAYS = 400;
export const MAX_RECURRING_OCCURRENCES_PER_PLAN = 14;

export type ReminderNativeScheduleKind = 'debt' | 'recurring_payment';
export type ReminderNativeScheduleStage = 'upcoming' | 'today';

export type DebtNativeScheduleInput = Pick<
  Debt,
  | 'id'
  | 'direction'
  | 'counterparty'
  | 'remaining'
  | 'currency'
  | 'status'
  | 'due_date'
  | 'reminder_enabled'
  | 'reminder_days_before'
  | 'reminder_time'
>;

export type RecurringPaymentNativeScheduleInput = Pick<
  RecurringPaymentReminder,
  | 'uid'
  | 'title'
  | 'expected_amount'
  | 'currency'
  | 'anchor_date'
  | 'next_due_date'
  | 'recurrence_unit'
  | 'recurrence_interval'
  | 'reminder_days_before'
  | 'reminder_time'
  | 'status'
  | 'source'
>;

export interface ReminderNativeSchedule {
  kind: ReminderNativeScheduleKind;
  stage: ReminderNativeScheduleStage;
  /** Kullanıcı metni içermeyen domain kimliği. */
  entityKey: string;
  /** Faz 4 uygulama-içi feed kaydıyla aynı, PII içermeyen kimlik. */
  notificationId: string;
  /** Native servis prefix'i olmadan, deterministik ve PII içermeyen kimlik. */
  scheduleId: string;
  dueDate: string;
  /** Alarm anından vadeye kalan takvim günü; vade-günü alarmında `0`. */
  daysUntilDue: number;
  /** Cihazın yerel takvim/saat seçiminin Unix epoch milisaniyesi. */
  triggerAt: number;
  /** Yalnız teslim içeriği üretmek içindir; kimliklere katılmaz. */
  label: string;
  amount: number | null;
  currency: string;
}

export interface BuildReminderNativeScheduleInput {
  /** `Date.now()` biçiminde epoch milisaniyesi. Yerel gün bu andan türetilir. */
  nowMs: number;
  debts: readonly DebtNativeScheduleInput[];
  recurringPayments: readonly RecurringPaymentNativeScheduleInput[];
}

interface LocalDateParts {
  year: number;
  month: number;
  day: number;
}

function parseYmdParts(value: string): LocalDateParts | null {
  if (!isValidYmd(value)) return null;
  const [year, month, day] = value.split('-').map(Number);
  return { year, month, day };
}

function pad2(value: number): string {
  return String(value).padStart(2, '0');
}

function localYmdAt(epochMs: number): string | null {
  if (!Number.isFinite(epochMs)) return null;
  const date = new Date(epochMs);
  if (Number.isNaN(date.getTime())) return null;
  const year = date.getFullYear();
  if (year < 1 || year > 9999) return null;
  return `${String(year).padStart(4, '0')}-${pad2(date.getMonth() + 1)}-${pad2(date.getDate())}`;
}

/**
 * Yerel YYYY-MM-DD + HH:MM değerini epoch milisaniyesine çevirir.
 *
 * `Date` bir DST ilkbahar boşluğunu (ör. Europe/Warsaw 02:30) aynı gün içindeki
 * ilk mümkün ileri saate normalize edebilir. Böyle bir durumda occurrence'ı
 * tamamen kaybetmek yerine platformun ileri normalizasyonu korunur. Tarihin
 * değişmesi, geriye kayma veya başka bir normalizasyon ise fail-closed reddedilir.
 */
export function localReminderDateTimeToEpoch(
  ymd: string,
  localTime: string,
): number | null {
  const parts = parseYmdParts(ymd);
  if (!parts || !HH_MM_PATTERN.test(localTime)) return null;
  const [hour, minute] = localTime.split(':').map(Number);

  // `new Date(year, ...)` 0–99 yıllarını 1900'lere eşlediği için yıl açıkça
  // `setFullYear` ile atanır.
  const date = new Date(0);
  date.setFullYear(parts.year, parts.month - 1, parts.day);
  date.setHours(hour, minute, 0, 0);

  const epoch = date.getTime();
  const actualMinutes = date.getHours() * 60 + date.getMinutes();
  const requestedMinutes = hour * 60 + minute;
  if (!Number.isFinite(epoch)
    || date.getFullYear() !== parts.year
    || date.getMonth() !== parts.month - 1
    || date.getDate() !== parts.day
    || actualMinutes < requestedMinutes
    || date.getSeconds() !== 0
    || date.getMilliseconds() !== 0) {
    return null;
  }
  return epoch;
}

function isValidLeadDays(value: unknown): value is number {
  return Number.isInteger(value) && Number(value) >= 0 && Number(value) <= 365;
}

function isValidReminderTime(value: unknown): value is string {
  return typeof value === 'string' && HH_MM_PATTERN.test(value);
}

function isValidCurrency(value: unknown): value is string {
  return typeof value === 'string'
    && value.length > 0
    && value.length <= 10
    && value.trim() === value;
}

function timeId(value: string): string {
  return value.replace(':', '');
}

function createSchedule(
  kind: ReminderNativeScheduleKind,
  stage: ReminderNativeScheduleStage,
  entityKey: string,
  entityId: string,
  dueDate: string,
  leadDays: number,
  reminderTime: string,
  label: string,
  amount: number | null,
  currency: string,
  nowMs: number,
): ReminderNativeSchedule | null {
  const triggerDate = stage === 'upcoming'
    ? shiftCalendarDate(dueDate, -leadDays)
    : dueDate;
  if (!triggerDate) return null;
  const triggerAt = localReminderDateTimeToEpoch(triggerDate, reminderTime);
  if (triggerAt == null || triggerAt <= nowMs) return null;

  const compactTime = timeId(reminderTime);
  const feedPrefix = kind === 'debt' ? 'debt-due-v1' : 'payplan-due-v1';
  const schedulePrefix = kind === 'debt' ? 'debt' : 'plan';
  return {
    kind,
    stage,
    entityKey,
    notificationId:
      `${feedPrefix}-${entityId}-${dueDate}-${leadDays}-${compactTime}-${stage}`,
    scheduleId:
      `${schedulePrefix}:${entityId}:${dueDate}:${leadDays}:${compactTime}:${stage}`,
    dueDate,
    daysUntilDue: stage === 'upcoming' ? leadDays : 0,
    triggerAt,
    label,
    amount,
    currency,
  };
}

function debtSchedules(
  debt: DebtNativeScheduleInput,
  nowMs: number,
): ReminderNativeSchedule[] {
  if (!debt || typeof debt !== 'object'
    || !Number.isInteger(debt.id) || debt.id <= 0
    || debt.direction !== 'borrowed'
    || debt.status !== 'open'
    || !Number.isFinite(debt.remaining) || debt.remaining <= 0
    || debt.reminder_enabled !== 1
    || !isValidYmd(debt.due_date)
    || !isValidLeadDays(debt.reminder_days_before)
    || !isValidReminderTime(debt.reminder_time)
    || !isValidCurrency(debt.currency)
    || typeof debt.counterparty !== 'string' || !debt.counterparty.trim()) {
    return [];
  }

  const entityKey = `debt:${debt.id}`;
  const id = String(debt.id);
  const dueDate = debt.due_date;
  const stages: ReminderNativeScheduleStage[] = debt.reminder_days_before > 0
    ? ['upcoming', 'today']
    : ['today'];
  return stages.flatMap((stage) => {
    const schedule = createSchedule(
      'debt',
      stage,
      entityKey,
      id,
      dueDate,
      debt.reminder_days_before,
      debt.reminder_time,
      debt.counterparty.trim(),
      debt.remaining,
      debt.currency,
      nowMs,
    );
    return schedule ? [schedule] : [];
  });
}

function isValidRecurringPayment(
  reminder: RecurringPaymentNativeScheduleInput,
): reminder is RecurringPaymentNativeScheduleInput {
  const uid = reminder && typeof reminder === 'object'
    ? normalizeCanonicalUuid(reminder.uid)
    : null;
  return !!uid
    && reminder.status === 'active'
    && (reminder.source === 'manual' || reminder.source === 'detected')
    && typeof reminder.title === 'string'
    && !!reminder.title.trim()
    && isValidCurrency(reminder.currency)
    && isValidYmd(reminder.anchor_date)
    && isValidYmd(reminder.next_due_date)
    && reminder.next_due_date >= reminder.anchor_date
    && SUPPORTED_UNITS.has(reminder.recurrence_unit)
    && Number.isInteger(reminder.recurrence_interval)
    && reminder.recurrence_interval >= 1
    && reminder.recurrence_interval <= 999
    && isRecurringOccurrence(
      reminder.recurrence_unit,
      reminder.recurrence_interval,
      reminder.anchor_date,
      reminder.next_due_date,
    )
    && isValidLeadDays(reminder.reminder_days_before)
    && isValidReminderTime(reminder.reminder_time)
    && (reminder.expected_amount === null
      || (Number.isFinite(reminder.expected_amount) && reminder.expected_amount >= 0));
}

function recurringSchedules(
  reminder: RecurringPaymentNativeScheduleInput,
  today: string,
  horizonDate: string,
  nowMs: number,
): ReminderNativeSchedule[] {
  if (!isValidRecurringPayment(reminder)) return [];
  const uid = normalizeCanonicalUuid(reminder.uid);
  if (!uid) return [];

  const recurrence: RecurringSchedule = {
    kind: 'recurring',
    unit: reminder.recurrence_unit,
    interval: reminder.recurrence_interval,
    anchorDate: reminder.anchor_date,
  };
  let occurrence = reminder.next_due_date < today
    ? getNextOccurrence(recurrence, today, 'on_or_after')
    : reminder.next_due_date;
  const stages: ReminderNativeScheduleStage[] = reminder.reminder_days_before > 0
    ? ['upcoming', 'today']
    : ['today'];
  const schedules: ReminderNativeSchedule[] = [];
  let occurrenceCount = 0;

  while (occurrence
    && occurrence <= horizonDate
    && occurrenceCount < MAX_RECURRING_OCCURRENCES_PER_PLAN) {
    for (const stage of stages) {
      const schedule = createSchedule(
        'recurring_payment',
        stage,
        `recurring:${uid}`,
        uid,
        occurrence,
        reminder.reminder_days_before,
        reminder.reminder_time,
        reminder.title.trim(),
        reminder.expected_amount,
        reminder.currency,
        nowMs,
      );
      if (schedule) schedules.push(schedule);
    }
    occurrenceCount += 1;
    occurrence = getNextOccurrence(recurrence, occurrence, 'strictly_after');
  }
  return schedules;
}

function scheduleSort(left: ReminderNativeSchedule, right: ReminderNativeSchedule): number {
  if (left.triggerAt !== right.triggerAt) return left.triggerAt - right.triggerAt;
  return left.scheduleId.localeCompare(right.scheduleId);
}

/**
 * Global sınır uygulanırken önce her varlığın en yakın alarmını korur. Kalan
 * kapasite ikinci, üçüncü… alarm turlarıyla adil biçimde dağıtılır; böylece sık
 * tekrarlanan tek bir plan daha seyrek planların ilk alarmını dışarı itemez.
 */
function capSchedulesFairly(
  candidates: readonly ReminderNativeSchedule[],
): ReminderNativeSchedule[] {
  const unique = new Map<string, ReminderNativeSchedule>();
  for (const candidate of candidates) {
    if (!unique.has(candidate.scheduleId)) unique.set(candidate.scheduleId, candidate);
  }

  const grouped = new Map<string, ReminderNativeSchedule[]>();
  for (const candidate of unique.values()) {
    const group = grouped.get(candidate.entityKey) ?? [];
    group.push(candidate);
    grouped.set(candidate.entityKey, group);
  }
  const groups = [...grouped.values()]
    .map((group) => group.sort(scheduleSort))
    .sort((left, right) => scheduleSort(left[0], right[0]));

  const selected: ReminderNativeSchedule[] = [];
  for (let round = 0; selected.length < MAX_NATIVE_REMINDER_SCHEDULES; round++) {
    let addedInRound = false;
    for (const group of groups) {
      const candidate = group[round];
      if (!candidate) continue;
      selected.push(candidate);
      addedInRound = true;
      if (selected.length >= MAX_NATIVE_REMINDER_SCHEDULES) break;
    }
    if (!addedInRound) break;
  }
  return selected.sort(scheduleSort);
}

/**
 * Borç ve onaylanmış düzenli ödeme kayıtlarından gelecekteki yerel alarmları
 * üretir. Yalnız `triggerAt > nowMs` kayıtları döner; geçmiş alarmlar daha sonra
 * gönderilmek üzere kaydırılmaz.
 */
export function buildReminderNativeSchedule(
  input: BuildReminderNativeScheduleInput,
): ReminderNativeSchedule[] {
  if (!input || typeof input !== 'object' || !Number.isFinite(input.nowMs)) return [];
  const today = localYmdAt(input.nowMs);
  if (!today) return [];
  const horizonDate = shiftCalendarDate(today, RECURRING_REMINDER_HORIZON_DAYS);
  if (!horizonDate) return [];

  const candidates: ReminderNativeSchedule[] = [];
  for (const debt of Array.isArray(input.debts) ? input.debts : []) {
    candidates.push(...debtSchedules(debt, input.nowMs));
  }
  for (const reminder of Array.isArray(input.recurringPayments)
    ? input.recurringPayments
    : []) {
    candidates.push(...recurringSchedules(
      reminder,
      today,
      horizonDate,
      input.nowMs,
    ));
  }
  return capSchedulesFairly(candidates);
}
