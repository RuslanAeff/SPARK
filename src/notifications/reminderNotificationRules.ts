// S.P.A.R.K. — Borç ve kullanıcı tarafından onaylanmış düzenli ödeme
// bildirimleri için saf, timezone-bağımsız kural motoru.
//
// Bu modül DB'ye, `Date`'e, bildirim API'sine veya kalıcı dedup state'ine
// dokunmaz. Çağıran katman yerel YYYY-MM-DD + HH:MM saatini verir; burada
// üretilen sabit kimlik/token değerleriyle feed state'ini yönetir.

import type { Debt, RecurringPaymentReminder } from '../db/schema';
import { normalizeCanonicalUuid } from '../utils/inputValidation';
import {
  getCalendarDayOffset,
  isRecurringOccurrence,
  isValidYmd,
} from '../utils/recurringSchedule';

const HH_MM_PATTERN = /^(?:[01]\d|2[0-3]):[0-5]\d$/;
const SUPPORTED_UNITS = new Set(['day', 'week', 'month', 'year']);

export type ReminderNotificationStage = 'upcoming' | 'today' | 'overdue';
export type ReminderNotificationKind = 'debt' | 'recurring_payment';

export type DebtReminderRuleInput = Pick<
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

export type RecurringPaymentReminderRuleInput = Pick<
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

export interface ReminderRuleClock {
  /** Cihazın yerel takvim günü; kanonik YYYY-MM-DD. */
  today: string;
  /** Cihazın yerel saati; kanonik 24 saatlik HH:MM. */
  localTime: string;
}

export interface ReminderNotificationCandidate {
  kind: ReminderNotificationKind;
  stage: ReminderNotificationStage;
  /** Entity başına kalıcı rule-state anahtarı. */
  entityKey: string;
  /** Aynı vade ve aşamayın tekrar üretilmesini engelleyen token. */
  dedupeToken: string;
  /** Feed birleştirme/silme için kullanıcı metni içermeyen sabit ID. */
  notificationId: string;
  dueDate: string;
  /** Pozitif: gelecekte; 0: bugün; negatif: gecikmiş. */
  daysUntilDue: number;
  reminderTime: string;
  label: string;
  amount: number | null;
  currency: string;
}

export interface BuildReminderNotificationCandidatesInput {
  clock: ReminderRuleClock;
  debts: readonly DebtReminderRuleInput[];
  recurringPayments: readonly RecurringPaymentReminderRuleInput[];
}

function isValidClock(clock: ReminderRuleClock): boolean {
  return !!clock
    && typeof clock === 'object'
    && isValidYmd(clock.today)
    && typeof clock.localTime === 'string'
    && HH_MM_PATTERN.test(clock.localTime);
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

function resolveStage(
  daysUntilDue: number,
  reminderDaysBefore: number,
): ReminderNotificationStage | null {
  if (daysUntilDue < 0) return 'overdue';
  if (daysUntilDue === 0) return 'today';
  return daysUntilDue <= reminderDaysBefore ? 'upcoming' : null;
}

function hasReachedStageTime(
  stage: ReminderNotificationStage,
  daysUntilDue: number,
  reminderDaysBefore: number,
  localTime: string,
  reminderTime: string,
): boolean {
  // Her aşama yalnız kendi ilk takvim gününde seçilen saati bekler. Örneğin
  // 3 gün önce 09:00 için uygulama ancak ertesi gün 08:00'de açılmışsa planlanan
  // an zaten geçmiştir; bildirimi bir saat daha geciktirmeyiz.
  const isFirstStageDay = stage === 'upcoming'
    ? daysUntilDue === reminderDaysBefore
    : stage === 'today';
  return !isFirstStageDay || localTime >= reminderTime;
}

function reminderToken(
  dueDate: string,
  leadDays: number,
  reminderTime: string,
  stage: ReminderNotificationStage,
): string {
  return `${dueDate}:${leadDays}:${reminderTime}:${stage}`;
}

function candidateSort(
  left: ReminderNotificationCandidate,
  right: ReminderNotificationCandidate,
): number {
  if (left.dueDate !== right.dueDate) return left.dueDate < right.dueDate ? -1 : 1;
  if (left.kind !== right.kind) return left.kind === 'debt' ? -1 : 1;
  if (left.notificationId === right.notificationId) return 0;
  return left.notificationId < right.notificationId ? -1 : 1;
}

function buildDebtCandidate(
  debt: DebtReminderRuleInput,
  clock: ReminderRuleClock,
): ReminderNotificationCandidate | null {
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
    || typeof debt.counterparty !== 'string') {
    return null;
  }

  const daysUntilDue = getCalendarDayOffset(clock.today, debt.due_date);
  if (daysUntilDue == null) return null;
  const stage = resolveStage(daysUntilDue, debt.reminder_days_before);
  if (!stage) return null;
  if (!hasReachedStageTime(
    stage,
    daysUntilDue,
    debt.reminder_days_before,
    clock.localTime,
    debt.reminder_time,
  )) return null;

  const entityKey = `debt:${debt.id}`;
  const dedupeToken = reminderToken(
    debt.due_date,
    debt.reminder_days_before,
    debt.reminder_time,
    stage,
  );
  return {
    kind: 'debt',
    stage,
    entityKey,
    dedupeToken,
    notificationId:
      `debt-due-v1-${debt.id}-${debt.due_date}-${debt.reminder_days_before}-${debt.reminder_time.replace(':', '')}-${stage}`,
    dueDate: debt.due_date,
    daysUntilDue,
    reminderTime: debt.reminder_time,
    label: debt.counterparty.trim(),
    amount: debt.remaining,
    currency: debt.currency,
  };
}

function buildRecurringCandidate(
  reminder: RecurringPaymentReminderRuleInput,
  clock: ReminderRuleClock,
): ReminderNotificationCandidate | null {
  const uid = reminder && typeof reminder === 'object'
    ? normalizeCanonicalUuid(reminder.uid)
    : null;
  if (!uid
    || reminder.status !== 'active'
    || (reminder.source !== 'manual' && reminder.source !== 'detected')
    || typeof reminder.title !== 'string' || !reminder.title.trim()
    || !isValidCurrency(reminder.currency)
    || !isValidYmd(reminder.anchor_date)
    || !isValidYmd(reminder.next_due_date)
    || reminder.next_due_date < reminder.anchor_date
    || !SUPPORTED_UNITS.has(reminder.recurrence_unit)
    || !Number.isInteger(reminder.recurrence_interval)
    || reminder.recurrence_interval < 1 || reminder.recurrence_interval > 999
    || !isRecurringOccurrence(
      reminder.recurrence_unit,
      reminder.recurrence_interval,
      reminder.anchor_date,
      reminder.next_due_date,
    )
    || !isValidLeadDays(reminder.reminder_days_before)
    || !isValidReminderTime(reminder.reminder_time)
    || (reminder.expected_amount !== null
      && (!Number.isFinite(reminder.expected_amount) || reminder.expected_amount < 0))) {
    return null;
  }

  // Yalnız `recurring_payment_reminders` girdileri bu fonksiyona kabul edilir.
  // Tahmini `subscriptions` satırları tip ve API sınırının dışındadır.
  const daysUntilDue = getCalendarDayOffset(clock.today, reminder.next_due_date);
  if (daysUntilDue == null) return null;
  const stage = resolveStage(daysUntilDue, reminder.reminder_days_before);
  if (!stage) return null;
  if (!hasReachedStageTime(
    stage,
    daysUntilDue,
    reminder.reminder_days_before,
    clock.localTime,
    reminder.reminder_time,
  )) return null;

  const entityKey = `recurring:${uid}`;
  const dedupeToken = reminderToken(
    reminder.next_due_date,
    reminder.reminder_days_before,
    reminder.reminder_time,
    stage,
  );
  return {
    kind: 'recurring_payment',
    stage,
    entityKey,
    dedupeToken,
    notificationId:
      `payplan-due-v1-${uid}-${reminder.next_due_date}-${reminder.reminder_days_before}-${reminder.reminder_time.replace(':', '')}-${stage}`,
    dueDate: reminder.next_due_date,
    daysUntilDue,
    reminderTime: reminder.reminder_time,
    label: reminder.title.trim(),
    amount: reminder.expected_amount,
    currency: reminder.currency,
  };
}

/**
 * Borç ve kullanıcının oluşturduğu/onayladığı düzenli ödeme planları
 * için o an geçerli adayları üretir. DB veya `next_due_date` mutasyonu yapmaz.
 */
export function buildReminderNotificationCandidates(
  input: BuildReminderNotificationCandidatesInput,
): ReminderNotificationCandidate[] {
  if (!input || typeof input !== 'object' || !isValidClock(input.clock)
    || !Array.isArray(input.debts) || !Array.isArray(input.recurringPayments)) {
    return [];
  }

  const candidates: ReminderNotificationCandidate[] = [];
  for (const debt of input.debts) {
    const candidate = buildDebtCandidate(debt, input.clock);
    if (candidate) candidates.push(candidate);
  }
  for (const reminder of input.recurringPayments) {
    const candidate = buildRecurringCandidate(reminder, input.clock);
    if (candidate) candidates.push(candidate);
  }
  return candidates.sort(candidateSort);
}
