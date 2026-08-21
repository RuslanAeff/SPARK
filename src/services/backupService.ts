// S.P.A.R.K. — Export / Import (backup) service
// Tarih aralığı bazlı yedek alma ve geri yükleme. Tüm işlemler tek
// SQLite transaction içinde atomik yürütülür; kısmi import riski yoktur.
//
// JSON format: { version, app, exportedAt, range:{start,end}, data:{...} }
// v3 içerik: giderler/kalemler, ilişkili satıcı-kategoriler, aralıktaki bütçe,
// borç/ödeme closure'ı, ek gelir ve tarih aralığından bağımsız kullanıcı ödeme
// hatırlatıcıları. Görsel/fiş dosyaları ve native bildirim kimlikleri taşınmaz.
import { File, Paths } from 'expo-file-system';
// `expo-file-system/legacy` içinden sadece SAF helper'larını kullanıyoruz.
// Paket `StorageAccessFramework`'ı bir TS namespace olarak `export declare` etse de,
// tsc'nin `moduleResolution: bundler` akışında bazı ortamlarda `types` alt yolu
// yakalanmıyor. Güvenli tarafta kalmak için lokal bir `any` tip referansı
// kullanıyoruz — çağrılan metotlar Expo tarafından belgelenmiş kamusal API'dir.
// eslint-disable-next-line @typescript-eslint/no-explicit-any
const FileSystemLegacy: any = require('expo-file-system/legacy');
import * as Sharing from 'expo-sharing';
import * as DocumentPicker from 'expo-document-picker';
import { Platform } from 'react-native';
import { getDatabase } from '../db/database';
import { Category, Expense, ExpenseItem, Vendor } from '../db/schema';
import {
  sanitizeAmount,
  sanitizeDate,
  normalizeCanonicalUuid,
  sanitizeText,
  sanitizeQuantity,
  sanitizeUnitPrice,
  stripDangerousKeys,
} from '../utils/inputValidation';
import { fromMinorUnits, roundMoney, toMinorUnits } from '../utils/moneyMath';
import { isRecurringOccurrence } from '../utils/recurringSchedule';
import { sanitizeMeasurementUnit } from '../utils/measurementUnit';

/** Mevcut yedek formatı sürümü.
 *  v1 → ilk sürüm
 *  v2 → vendors.default_category_name + dismissed subscriptions
 *  v3 → borçlar/ödemeler, ek gelirler ve kullanıcı tanımlı ödeme hatırlatıcıları
 *
 * Yeni alanlar v1/v2 importunda boş dizilere normalize edilir. Eski uygulamalar
 * v3 dosyasını `UNSUPPORTED_VERSION` ile bilinçli biçimde reddeder. */
export const BACKUP_FORMAT_VERSION = 3;

const MIN_BACKUP_FORMAT_VERSION = 1;
const MAX_BACKUP_ROWS_PER_COLLECTION = 100_000;
const MAX_BACKUP_ITEMS = 250_000;
const MAX_BACKUP_FILE_BYTES = 25 * 1024 * 1024;

/** Aralık dışı tarihler import edildiğinde de kabul edilir; aralık sadece EXPORT kapsamı. */
export interface BackupDateRange {
  /** YYYY-MM-DD */
  start: string;
  /** YYYY-MM-DD */
  end: string;
}

interface ExportedExpenseItem
  extends Omit<ExpenseItem, 'id' | 'expense_id' | 'category_id'> {
  category_name?: string | null;
}

interface ExportedExpense {
  /** v3+: yalnız bu payload içindeki FK eşlemeleri için; hedef DB PK'si değildir. */
  source_id?: number;
  /** v3+: aynı dosyanın tekrar importunda meşru özdeş işlemleri ayırmaya yardım eder. */
  created_at?: string;
  date: string;
  total_amount: number;
  currency: string;
  note: string | null;
  receipt_uri: string | null;
  vendor_name: string | null;
  category_name: string | null;
  items: ExportedExpenseItem[];
}

interface ExportedCategory {
  name: string;
  icon: string;
  color: string;
  parent_name: string | null;
}

interface ExportedVendor {
  name: string;
  logo_uri: string | null;
  /** v2+: bu satıcı için ayarlanmış varsayılan kategori adı (yaprak ya da kök). */
  default_category_name?: string | null;
}

interface ExportedBudget {
  monthly_amount: number;
  currency: string;
  start_date: string;
  period_start?: string | null;
  period_end?: string | null;
  cycle_start_day?: number | null;
}

/** v2+: kullanıcının "abonelik değil" tepkisi vermiş satıcılar.
 *  Aktif abonelikler import sonrası yerel veriden tespit edilir; dismissed
 *  kayıtlar ise tekrar uyarı çıkmaması için listede tutulur. */
interface ExportedDismissedSubscription {
  vendor_name: string;
}

interface ExportedDebt {
  source_id: number;
  linked_expense_source_id: number | null;
  /**
   * `true` yalnız kaynak borcun bir harcamaya bağlı olduğu, fakat harcamanın
   * seçilen export aralığı dışında kaldığı anlamına gelir. `null` FK'nin
   * gerçekten bağlantısız borç mu yoksa eksik ilişki mi olduğunu tahmin etmeyiz.
   */
  linked_expense_relation_omitted: boolean;
  direction: 'borrowed' | 'lent';
  counterparty: string;
  amount: number;
  currency: string;
  date: string;
  due_date: string | null;
  reminder_enabled: boolean;
  reminder_days_before: number;
  reminder_time: string;
  note: string | null;
  created_at: string;
}

interface ExportedDebtPayment {
  source_id: number;
  debt_source_id: number;
  amount: number;
  date: string;
  created_at: string;
}

interface ExportedExtraIncome {
  source_id: number;
  source: string;
  amount: number;
  currency: string;
  date: string;
  note: string | null;
  created_at: string;
}

interface ExportedRecurringPaymentReminder {
  uid: string;
  title: string;
  vendor_name: string | null;
  expected_amount: number | null;
  currency: string;
  anchor_date: string;
  next_due_date: string;
  recurrence_unit: 'day' | 'week' | 'month' | 'year';
  recurrence_interval: number;
  reminder_days_before: number;
  reminder_time: string;
  status: 'active' | 'paused';
  source: 'manual' | 'detected';
  note: string | null;
  created_at: string;
  updated_at: string;
}

export interface BackupPayload {
  version: number;
  app: 'S.P.A.R.K.';
  exportedAt: string;
  range: BackupDateRange;
  data: {
    expenses: ExportedExpense[];
    categories: ExportedCategory[];
    vendors: ExportedVendor[];
    budgets: ExportedBudget[];
    /** v2+: opsiyonel — eski sürüm yedeklerinde bulunmayabilir. */
    dismissed_subscriptions?: ExportedDismissedSubscription[];
    /** v3+: v1/v2 uyumluluğu için tipte opsiyonel, v3 doğrulamasında zorunlu. */
    debts?: ExportedDebt[];
    debt_payments?: ExportedDebtPayment[];
    extra_incomes?: ExportedExtraIncome[];
    recurring_payment_reminders?: ExportedRecurringPaymentReminder[];
  };
}

export type ExportDestination =
  /** Kullanıcı Android SAF diyaloğunda bir klasör seçti ve dosya oraya yazıldı. */
  | 'saved'
  /** Sistem paylaş ekranı açıldı (iOS veya SAF'tan geri düşüş). */
  | 'shared'
  /** Kullanıcı SAF klasör seçimi diyaloğunu iptal etti, dosya paylaş veya SAF ile
   *  cihaza yerleşmedi; sadece uygulama önbelleğinde tutuluyor. */
  | 'cancelled';

export interface ExportResult {
  /** Her durumda üretilen önbellek kopyasının yolu. */
  fileUri: string;
  /** Kullanıcının seçtiği klasöre yazılan dosyanın SAF URI'si (yalnızca Android, başarılıysa). */
  savedUri?: string;
  fileName: string;
  expenseCount: number;
  itemCount: number;
  debtCount: number;
  debtPaymentCount: number;
  incomeCount: number;
  reminderCount: number;
  /** Fiş kalemleri dışındaki taşınabilir finansal/yapılandırma kayıtlarının toplamı. */
  recordCount: number;
  sizeBytes: number;
  destination: ExportDestination;
}

export interface ImportSummary {
  expensesAdded: number;
  expensesSkipped: number;
  itemsAdded: number;
  categoriesAdded: number;
  vendorsAdded: number;
  budgetsAdded: number;
  debtsAdded: number;
  debtsSkipped: number;
  debtPaymentsAdded: number;
  debtPaymentsSkipped: number;
  extraIncomesAdded: number;
  extraIncomesSkipped: number;
  remindersAdded: number;
  remindersSkipped: number;
}

/** `YYYY-MM-DD` doğrulaması + başlangıç <= son kuralı. */
function assertValidRange(range: BackupDateRange): void {
  const s = sanitizeDate(range.start);
  const e = sanitizeDate(range.end);
  if (!s || !e) throw new Error('INVALID_RANGE');
  if (s > e) throw new Error('RANGE_INVERTED');
}

/** Aralıktaki ay anahtarlarını (`YYYY-MM`) üretir — bütçeleri filtrelemek için. */
function monthsInRange(range: BackupDateRange): Set<string> {
  const out = new Set<string>();
  const [sy, sm] = range.start.split('-').map(Number);
  const [ey, em] = range.end.split('-').map(Number);
  let y = sy;
  let m = sm;
  while (y < ey || (y === ey && m <= em)) {
    out.add(`${y}-${String(m).padStart(2, '0')}`);
    m += 1;
    if (m > 12) {
      m = 1;
      y += 1;
    }
  }
  return out;
}

type NormalizedBackupPayload = BackupPayload & {
  data: BackupPayload['data'] & {
    debts: ExportedDebt[];
    debt_payments: ExportedDebtPayment[];
    extra_incomes: ExportedExtraIncome[];
    recurring_payment_reminders: ExportedRecurringPaymentReminder[];
    dismissed_subscriptions: ExportedDismissedSubscription[];
  };
};

function invalidFormat(): never {
  throw new Error('INVALID_FORMAT');
}

function asRecord(value: unknown): Record<string, unknown> {
  if (!value || typeof value !== 'object' || Array.isArray(value)) invalidFormat();
  return value as Record<string, unknown>;
}

function asBoundedArray(value: unknown): unknown[] {
  if (!Array.isArray(value) || value.length > MAX_BACKUP_ROWS_PER_COLLECTION) invalidFormat();
  return value;
}

function isStrictDate(value: unknown): value is string {
  return typeof value === 'string' && sanitizeDate(value) === value;
}

function isMonthKey(value: unknown): value is string {
  if (typeof value !== 'string' || !/^\d{4}-\d{2}$/.test(value)) return false;
  const month = Number(value.slice(5, 7));
  return month >= 1 && month <= 12;
}

function isStrictTime(value: unknown): value is string {
  if (typeof value !== 'string') return false;
  const match = /^(\d{2}):(\d{2})$/.exec(value);
  return !!match && Number(match[1]) <= 23 && Number(match[2]) <= 59;
}

function isIsoTimestamp(value: unknown): value is string {
  return typeof value === 'string'
    && value.length <= 64
    && Number.isFinite(Date.parse(value));
}

function numeric(value: unknown): number | null {
  const number = typeof value === 'number' ? value : Number(value);
  return Number.isFinite(number) ? number : null;
}

function isNonNegativeMoney(value: unknown): boolean {
  const number = numeric(value);
  return number != null && number >= 0 && number <= 999_999_999;
}

function isPositiveMoney(value: unknown): boolean {
  const number = numeric(value);
  return number != null && number > 0 && number <= 999_999_999;
}

function isPositiveInteger(value: unknown): value is number {
  return typeof value === 'number' && Number.isSafeInteger(value) && value > 0;
}

function isBoundedString(value: unknown, maxLength: number, allowEmpty = true): value is string {
  return typeof value === 'string'
    && value.length <= maxLength
    && (allowEmpty || value.trim().length > 0);
}

function isNullableBoundedString(value: unknown, maxLength: number): boolean {
  return value == null || isBoundedString(value, maxLength);
}

function addPoolCandidate(pool: Map<string, number[]>, key: string, id: number): void {
  const candidates = pool.get(key) ?? [];
  candidates.push(id);
  pool.set(key, candidates);
}

function takePoolCandidate(
  pool: Map<string, number[]>,
  key: string,
  consumed?: Set<number>,
): number | null {
  const candidates = pool.get(key);
  let id = candidates?.shift();
  while (id != null && consumed?.has(id)) id = candidates?.shift();
  if (!candidates?.length) pool.delete(key);
  if (id != null) consumed?.add(id);
  return id ?? null;
}

function validateBaseCollections(data: Record<string, unknown>): void {
  const expenses = asBoundedArray(data.expenses);
  const categories = asBoundedArray(data.categories);
  const vendors = asBoundedArray(data.vendors);
  const budgets = asBoundedArray(data.budgets);
  let itemCount = 0;

  for (const raw of expenses) {
    const expense = asRecord(raw);
    if (!isStrictDate(expense.date) || !isNonNegativeMoney(expense.total_amount)) invalidFormat();
    if (!isBoundedString(expense.currency, 10, false)
      || !isNullableBoundedString(expense.note, 1000)
      || !isNullableBoundedString(expense.receipt_uri, 2000)
      || !isNullableBoundedString(expense.vendor_name, 200)
      || !isNullableBoundedString(expense.category_name, 100)) invalidFormat();
    const items = asBoundedArray(expense.items);
    itemCount += items.length;
    if (itemCount > MAX_BACKUP_ITEMS) invalidFormat();
    for (const rawItem of items) {
      const item = asRecord(rawItem);
      const quantity = numeric(item.quantity);
      const unitPrice = numeric(item.unit_price);
      const totalPrice = numeric(item.total_price);
      if (!isBoundedString(item.name, 500, false)
        || !isNullableBoundedString(item.turkish_name, 500)
        || quantity == null || quantity <= 0 || quantity > 999_999
        || unitPrice == null || Math.abs(unitPrice) > 999_999_999
        || totalPrice == null || Math.abs(totalPrice) > 999_999_999
        || !isNullableBoundedString(item.category_name, 100)) invalidFormat();
      if (item.measurement_unit != null
        && !['piece', 'kg', 'l'].includes(String(item.measurement_unit))) invalidFormat();
      if (item.line_discount != null && !isNonNegativeMoney(item.line_discount)) invalidFormat();
      if (item.list_line_total_before_discount != null
        && !isNonNegativeMoney(item.list_line_total_before_discount)) invalidFormat();
    }
  }

  for (const raw of categories) {
    const category = asRecord(raw);
    if (!isBoundedString(category.name, 100, false)
      || !isBoundedString(category.icon, 100, false)
      || !isBoundedString(category.color, 20, false)
      || !isNullableBoundedString(category.parent_name, 100)) invalidFormat();
  }
  for (const raw of vendors) {
    const vendor = asRecord(raw);
    if (!isBoundedString(vendor.name, 200, false)
      || !isNullableBoundedString(vendor.logo_uri, 2000)
      || (vendor.default_category_name != null
        && !isBoundedString(vendor.default_category_name, 100))) invalidFormat();
  }
  for (const raw of budgets) {
    const budget = asRecord(raw);
    if (!isNonNegativeMoney(budget.monthly_amount)
      || !isBoundedString(budget.currency, 10, false)
      || !isMonthKey(budget.start_date)
      || (budget.period_start != null && !isStrictDate(budget.period_start))
      || (budget.period_end != null && !isStrictDate(budget.period_end))
      || (budget.cycle_start_day != null
        && (!Number.isInteger(budget.cycle_start_day)
          || Number(budget.cycle_start_day) < 1
          || Number(budget.cycle_start_day) > 31))) invalidFormat();
  }

  if (data.dismissed_subscriptions != null) {
    for (const raw of asBoundedArray(data.dismissed_subscriptions)) {
      const dismissed = asRecord(raw);
      if (!isBoundedString(dismissed.vendor_name, 200, false)) invalidFormat();
    }
  }
}

function validateV3Collections(data: Record<string, unknown>): void {
  const expenses = data.expenses as Record<string, unknown>[];
  const debts = asBoundedArray(data.debts);
  const payments = asBoundedArray(data.debt_payments);
  const incomes = asBoundedArray(data.extra_incomes);
  const reminders = asBoundedArray(data.recurring_payment_reminders);
  const vendorNames = new Set(
    (data.vendors as Record<string, unknown>[])
      .map((vendor) => String(vendor.name).trim().toLowerCase())
      .filter(Boolean),
  );

  const expenseIds = new Set<number>();
  for (const expense of expenses) {
    if (!isPositiveInteger(expense.source_id)
      || expenseIds.has(expense.source_id)
      || !isIsoTimestamp(expense.created_at)) invalidFormat();
    expenseIds.add(expense.source_id);
  }

  const debtIds = new Set<number>();
  const debtAmountMinor = new Map<number, number>();
  for (const raw of debts) {
    const debt = asRecord(raw);
    if (!isPositiveInteger(debt.source_id) || debtIds.has(debt.source_id)) invalidFormat();
    debtIds.add(debt.source_id);
    if (debt.linked_expense_source_id != null
      && (!isPositiveInteger(debt.linked_expense_source_id)
        || !expenseIds.has(debt.linked_expense_source_id))) invalidFormat();
    if (typeof debt.linked_expense_relation_omitted !== 'boolean'
      || (debt.linked_expense_source_id != null && debt.linked_expense_relation_omitted)) {
      invalidFormat();
    }
    if ((debt.direction !== 'borrowed' && debt.direction !== 'lent')
      || !isBoundedString(debt.counterparty, 200)
      || !isPositiveMoney(debt.amount)
      || !isBoundedString(debt.currency, 10, false)
      || !isStrictDate(debt.date)
      || (debt.due_date != null && !isStrictDate(debt.due_date))
      || typeof debt.reminder_enabled !== 'boolean'
      || !Number.isInteger(debt.reminder_days_before)
      || Number(debt.reminder_days_before) < 0
      || Number(debt.reminder_days_before) > 365
      || !isStrictTime(debt.reminder_time)
      || !isNullableBoundedString(debt.note, 1000)
      || !isIsoTimestamp(debt.created_at)) invalidFormat();
    if (debt.reminder_enabled && debt.due_date == null) invalidFormat();
    debtAmountMinor.set(debt.source_id, toMinorUnits(Number(debt.amount)));
  }

  const paymentIds = new Set<number>();
  const paidMinor = new Map<number, number>();
  for (const raw of payments) {
    const payment = asRecord(raw);
    if (!isPositiveInteger(payment.source_id) || paymentIds.has(payment.source_id)) invalidFormat();
    paymentIds.add(payment.source_id);
    if (!isPositiveInteger(payment.debt_source_id) || !debtIds.has(payment.debt_source_id)
      || !isPositiveMoney(payment.amount)
      || !isStrictDate(payment.date)
      || !isIsoTimestamp(payment.created_at)) invalidFormat();
    const next = (paidMinor.get(payment.debt_source_id) ?? 0)
      + toMinorUnits(Number(payment.amount));
    paidMinor.set(payment.debt_source_id, next);
  }
  for (const [debtId, totalPaid] of paidMinor) {
    if (totalPaid > (debtAmountMinor.get(debtId) ?? 0)) invalidFormat();
  }
  // Tam ödenmiş borçta hatırlatıcı türetilmiş olarak kapalıdır. v3 dosyası eski
  // bir açık tercih taşısa bile normalize edilen payload, import sonrası DB ile
  // aynı kanonik duruma gelir ve tekrar import idempotent kalır.
  for (const raw of debts) {
    const debt = asRecord(raw);
    const sourceId = Number(debt.source_id);
    if ((paidMinor.get(sourceId) ?? 0) === debtAmountMinor.get(sourceId)) {
      debt.reminder_enabled = false;
    }
  }

  const incomeIds = new Set<number>();
  for (const raw of incomes) {
    const income = asRecord(raw);
    if (!isPositiveInteger(income.source_id) || incomeIds.has(income.source_id)) invalidFormat();
    incomeIds.add(income.source_id);
    if (!isBoundedString(income.source, 200)
      || !isPositiveMoney(income.amount)
      || !isBoundedString(income.currency, 10, false)
      || !isStrictDate(income.date)
      || !isNullableBoundedString(income.note, 1000)
      || !isIsoTimestamp(income.created_at)) invalidFormat();
  }

  const reminderUids = new Set<string>();
  for (const raw of reminders) {
    const reminder = asRecord(raw);
    const normalizedUid = normalizeCanonicalUuid(reminder.uid);
    if (!normalizedUid || reminderUids.has(normalizedUid)) invalidFormat();
    reminder.uid = normalizedUid;
    reminderUids.add(normalizedUid);
    const vendorName = reminder.vendor_name == null
      ? null
      : String(reminder.vendor_name).trim().toLowerCase();
    if (!isBoundedString(reminder.title, 200, false)
      || !isNullableBoundedString(reminder.vendor_name, 200)
      || (vendorName != null && (!vendorName || !vendorNames.has(vendorName)))
      || (reminder.expected_amount != null && !isNonNegativeMoney(reminder.expected_amount))
      || !isBoundedString(reminder.currency, 10, false)
      || !isStrictDate(reminder.anchor_date)
      || !isStrictDate(reminder.next_due_date)
      || String(reminder.next_due_date) < String(reminder.anchor_date)
      || !['day', 'week', 'month', 'year'].includes(String(reminder.recurrence_unit))
      || !Number.isInteger(reminder.recurrence_interval)
      || Number(reminder.recurrence_interval) <= 0
      || Number(reminder.recurrence_interval) > 999
      || !Number.isInteger(reminder.reminder_days_before)
      || Number(reminder.reminder_days_before) < 0
      || Number(reminder.reminder_days_before) > 365
      || !isStrictTime(reminder.reminder_time)
      || !['active', 'paused'].includes(String(reminder.status))
      || !['manual', 'detected'].includes(String(reminder.source))
      || !isNullableBoundedString(reminder.note, 1000)
      || !isIsoTimestamp(reminder.created_at)
      || !isIsoTimestamp(reminder.updated_at)) invalidFormat();
    if (reminder.source === 'detected' && vendorName == null) invalidFormat();
    if (!isRecurringOccurrence(
      reminder.recurrence_unit,
      reminder.recurrence_interval,
      reminder.anchor_date,
      reminder.next_due_date,
    )) invalidFormat();
  }
}

/** Dosya ve doğrudan import yollarının kullandığı tek runtime sözleşmesi. */
export function validateAndNormalizeBackupPayload(input: unknown): NormalizedBackupPayload {
  const root = asRecord(input);
  if (root.app !== 'S.P.A.R.K.'
    || typeof root.version !== 'number'
    || !Number.isInteger(root.version)
    || root.version < MIN_BACKUP_FORMAT_VERSION) invalidFormat();
  if (root.version > BACKUP_FORMAT_VERSION) throw new Error('UNSUPPORTED_VERSION');
  if (!isIsoTimestamp(root.exportedAt)) invalidFormat();

  const range = asRecord(root.range);
  if (!isStrictDate(range.start) || !isStrictDate(range.end) || range.start > range.end) invalidFormat();
  const data = asRecord(root.data);
  validateBaseCollections(data);

  if (root.version >= 3) {
    if (!Array.isArray(data.debts)
      || !Array.isArray(data.debt_payments)
      || !Array.isArray(data.extra_incomes)
      || !Array.isArray(data.recurring_payment_reminders)) invalidFormat();
    validateV3Collections(data);
  }

  return {
    ...(root as unknown as BackupPayload),
    data: {
      ...(data as unknown as BackupPayload['data']),
      dismissed_subscriptions:
        (data.dismissed_subscriptions as ExportedDismissedSubscription[] | undefined) ?? [],
      debts: root.version >= 3 ? data.debts as ExportedDebt[] : [],
      debt_payments: root.version >= 3 ? data.debt_payments as ExportedDebtPayment[] : [],
      extra_incomes: root.version >= 3 ? data.extra_incomes as ExportedExtraIncome[] : [],
      recurring_payment_reminders: root.version >= 3
        ? data.recurring_payment_reminders as ExportedRecurringPaymentReminder[]
        : [],
    },
  };
}

export async function buildBackupPayload(range: BackupDateRange): Promise<BackupPayload> {
  assertValidRange(range);
  const db = await getDatabase();

  const expenses = await db.getAllAsync<
    Expense & { vendor_name: string | null; category_name: string | null }
  >(
    `SELECT e.id, e.vendor_id, e.category_id, e.total_amount, e.currency, e.note, e.receipt_uri, e.date, e.created_at,
            v.name AS vendor_name, c.name AS category_name
       FROM expenses e
       LEFT JOIN vendors v ON e.vendor_id = v.id
       LEFT JOIN categories c ON e.category_id = c.id
      WHERE e.date BETWEEN ? AND ?
      ORDER BY e.date ASC, e.id ASC`,
    [range.start, range.end]
  );

  const vendorNames = new Set<string>();
  const categoryIds = new Set<number>();

  const expensesOut: ExportedExpense[] = [];
  for (const exp of expenses) {
    if (exp.vendor_name) vendorNames.add(exp.vendor_name);
    if (exp.category_id != null) categoryIds.add(exp.category_id);

    const rawItems = await db.getAllAsync<ExpenseItem & { category_name?: string | null }>(
      `SELECT i.*, c.name AS category_name
         FROM expense_items i
         LEFT JOIN categories c ON i.category_id = c.id
        WHERE i.expense_id = ?
        ORDER BY i.id ASC`,
      [exp.id]
    );

    const items: ExportedExpenseItem[] = rawItems.map(it => {
      if (it.category_id != null) categoryIds.add(it.category_id);
      return {
        name: it.name,
        turkish_name: it.turkish_name ?? null,
        quantity: it.quantity,
        measurement_unit: sanitizeMeasurementUnit(it.measurement_unit),
        unit_price: it.unit_price,
        total_price: it.total_price,
        line_discount: it.line_discount ?? null,
        list_line_total_before_discount: it.list_line_total_before_discount ?? null,
        category_name: it.category_name ?? null,
      };
    });

    expensesOut.push({
      source_id: exp.id,
      created_at: exp.created_at,
      date: exp.date,
      total_amount: exp.total_amount,
      currency: exp.currency,
      note: exp.note,
      receipt_uri: exp.receipt_uri,
      vendor_name: exp.vendor_name ?? null,
      category_name: exp.category_name ?? null,
      items,
    });
  }

  // Dismissed state ve reminder ilişkileri tarih aralığından bağımsız kullanıcı
  // yapılandırmasıdır. Vendor union'ı kurulmadan önce okunurlar.
  const dismissedSubsRows = await db.getAllAsync<{ vendor_name: string }>(
    `SELECT v.name AS vendor_name
       FROM subscriptions s
       JOIN vendors v ON s.vendor_id = v.id
      WHERE s.status = 'dismissed'`
  );
  const dismissedSubsOut: ExportedDismissedSubscription[] = dismissedSubsRows.map((r) => ({
    vendor_name: r.vendor_name,
  }));
  for (const row of dismissedSubsRows) vendorNames.add(row.vendor_name);

  // Borç closure: borcun kendisi YA DA ödemelerinden biri aralıktaysa parent
  // borç ve ona ait tüm ödeme geçmişi birlikte taşınır.
  const debtRows = await db.getAllAsync<{
    id: number;
    direction: 'borrowed' | 'lent';
    counterparty: string;
    amount: number;
    remaining: number;
    currency: string;
    date: string;
    status: 'open' | 'settled';
    due_date: string | null;
    reminder_enabled: number;
    reminder_days_before: number;
    reminder_time: string;
    linked_expense_id: number | null;
    note: string | null;
    created_at: string;
  }>(
    `SELECT d.id, d.direction, d.counterparty, d.amount, d.remaining,
            d.currency, d.date, d.status,
            d.due_date, d.reminder_enabled, d.reminder_days_before,
            d.reminder_time, d.linked_expense_id, d.note, d.created_at
       FROM debts d
      WHERE d.date BETWEEN ? AND ?
         OR EXISTS (
           SELECT 1 FROM debt_payments p
            WHERE p.debt_id = d.id AND p.date BETWEEN ? AND ?
         )
      ORDER BY d.date ASC, d.id ASC`,
    [range.start, range.end, range.start, range.end],
  );
  const exportedExpenseIds = new Set(expenses.map(expense => expense.id));
  const debtsOut: ExportedDebt[] = debtRows.map(debt => ({
    source_id: debt.id,
    linked_expense_source_id:
      debt.linked_expense_id != null && exportedExpenseIds.has(debt.linked_expense_id)
        ? debt.linked_expense_id
        : null,
    linked_expense_relation_omitted:
      debt.linked_expense_id != null && !exportedExpenseIds.has(debt.linked_expense_id),
    direction: debt.direction,
    counterparty: debt.counterparty,
    amount: debt.amount,
    currency: debt.currency,
    date: debt.date,
    due_date: debt.due_date ?? null,
    reminder_enabled:
      debt.status === 'open' && toMinorUnits(debt.remaining) > 0
        ? debt.reminder_enabled === 1
        : false,
    reminder_days_before: debt.reminder_days_before,
    reminder_time: debt.reminder_time,
    note: debt.note,
    created_at: debt.created_at,
  }));

  const paymentRows = await db.getAllAsync<{
    id: number;
    debt_id: number;
    amount: number;
    date: string;
    created_at: string;
  }>(
    `SELECT p.id, p.debt_id, p.amount, p.date, p.created_at
       FROM debt_payments p
       JOIN debts d ON d.id = p.debt_id
      WHERE d.date BETWEEN ? AND ?
         OR EXISTS (
           SELECT 1 FROM debt_payments rp
            WHERE rp.debt_id = d.id AND rp.date BETWEEN ? AND ?
         )
      ORDER BY p.debt_id ASC, p.date ASC, p.id ASC`,
    [range.start, range.end, range.start, range.end],
  );
  const debtPaymentsOut: ExportedDebtPayment[] = paymentRows.map(payment => ({
    source_id: payment.id,
    debt_source_id: payment.debt_id,
    amount: payment.amount,
    date: payment.date,
    created_at: payment.created_at,
  }));

  const incomeRows = await db.getAllAsync<{
    id: number;
    source: string;
    amount: number;
    currency: string;
    date: string;
    note: string | null;
    created_at: string;
  }>(
    `SELECT id, source, amount, currency, date, note, created_at
       FROM extra_incomes
      WHERE date BETWEEN ? AND ?
      ORDER BY date ASC, id ASC`,
    [range.start, range.end],
  );
  const extraIncomesOut: ExportedExtraIncome[] = incomeRows.map(income => ({
    source_id: income.id,
    source: income.source,
    amount: income.amount,
    currency: income.currency,
    date: income.date,
    note: income.note,
    created_at: income.created_at,
  }));

  const reminderRows = await db.getAllAsync<{
    uid: string;
    title: string;
    vendor_name: string | null;
    expected_amount: number | null;
    currency: string;
    anchor_date: string;
    next_due_date: string;
    recurrence_unit: 'day' | 'week' | 'month' | 'year';
    recurrence_interval: number;
    reminder_days_before: number;
    reminder_time: string;
    status: 'active' | 'paused';
    source: 'manual' | 'detected';
    note: string | null;
    created_at: string;
    updated_at: string;
  }>(
    `SELECT r.uid, r.title, v.name AS vendor_name, r.expected_amount, r.currency,
            r.anchor_date, r.next_due_date, r.recurrence_unit,
            r.recurrence_interval, r.reminder_days_before, r.reminder_time,
            r.status, r.source, r.note, r.created_at, r.updated_at
       FROM recurring_payment_reminders r
       LEFT JOIN vendors v ON v.id = r.vendor_id
      ORDER BY r.created_at ASC, r.id ASC`,
  );
  const remindersOut: ExportedRecurringPaymentReminder[] = reminderRows.map(reminder => ({
    ...reminder,
    vendor_name: reminder.vendor_name ?? null,
    expected_amount: reminder.expected_amount ?? null,
    note: reminder.note ?? null,
  }));
  for (const reminder of reminderRows) {
    if (reminder.vendor_name) vendorNames.add(reminder.vendor_name);
  }

  // Vendor listesini tüm domain referanslarının birleşiminden üret. Tüm vendor
  // tablosunu tek sorguda okuyup JS'te filtrelemek SQLite placeholder limitini
  // ve dinamik IN sorgusunu önler.
  const wantedVendorNames = new Set(Array.from(vendorNames, name => name.trim().toLowerCase()));
  const allVendorRows = await db.getAllAsync<
    Vendor & { default_category_name: string | null }
  >(
    `SELECT v.id, v.name, v.logo_uri, v.default_category_id, v.created_at,
            c.name AS default_category_name
       FROM vendors v
       LEFT JOIN categories c ON v.default_category_id = c.id`,
  );
  const vendorsOut: ExportedVendor[] = [];
  for (const vendor of allVendorRows) {
    if (!wantedVendorNames.has(vendor.name.trim().toLowerCase())) continue;
    if (vendor.default_category_id != null) categoryIds.add(vendor.default_category_id);
    vendorsOut.push({
      name: vendor.name,
      logo_uri: vendor.logo_uri,
      default_category_name: vendor.default_category_name ?? null,
    });
  }

  // Referans verilen kategoriler + üstleri (parent zincirini tam almak için).
  const allCats = await db.getAllAsync<Category>('SELECT * FROM categories');
  const catById = new Map<number, Category>();
  for (const category of allCats) catById.set(category.id, category);
  const closed = new Set<number>();
  for (const id of categoryIds) {
    let current: number | null = id;
    while (current != null && !closed.has(current)) {
      closed.add(current);
      current = catById.get(current)?.parent_id ?? null;
    }
  }
  const categoriesOut: ExportedCategory[] = [];
  const orderedCats = Array.from(closed).sort((left, right) => {
    const leftParent = catById.get(left)?.parent_id == null ? 0 : 1;
    const rightParent = catById.get(right)?.parent_id == null ? 0 : 1;
    return leftParent !== rightParent ? leftParent - rightParent : left - right;
  });
  for (const id of orderedCats) {
    const category = catById.get(id);
    if (!category) continue;
    const parent = category.parent_id != null ? catById.get(category.parent_id) ?? null : null;
    categoriesOut.push({
      name: category.name,
      icon: category.icon,
      color: category.color,
      parent_name: parent?.name ?? null,
    });
  }

  // Bütçeler: aralıkta kalan YYYY-MM ayları
  const months = monthsInRange(range);
  const budgetRows = await db.getAllAsync<{
    monthly_amount: number;
    currency: string;
    start_date: string;
    period_start: string | null;
    period_end: string | null;
    cycle_start_day: number | null;
  }>(
    `SELECT monthly_amount, currency, start_date, period_start, period_end, cycle_start_day
     FROM budgets WHERE active = 1`
  );
  const budgetsOut: ExportedBudget[] = budgetRows
    .filter(b => months.has(b.start_date)
      || Boolean(b.period_start && b.period_end
        && b.period_start <= range.end && b.period_end >= range.start))
    .map(b => ({
      monthly_amount: b.monthly_amount,
      currency: b.currency,
      start_date: b.start_date,
      period_start: b.period_start,
      period_end: b.period_end,
      cycle_start_day: b.cycle_start_day,
    }));

  return {
    version: BACKUP_FORMAT_VERSION,
    app: 'S.P.A.R.K.',
    exportedAt: new Date().toISOString(),
    range,
    data: {
      expenses: expensesOut,
      categories: categoriesOut,
      vendors: vendorsOut,
      budgets: budgetsOut,
      dismissed_subscriptions: dismissedSubsOut,
      debts: debtsOut,
      debt_payments: debtPaymentsOut,
      extra_incomes: extraIncomesOut,
      recurring_payment_reminders: remindersOut,
    },
  };
}

/**
 * Yedeği cihaza kaydeder.
 *
 *  • Android: SAF (Storage Access Framework) ile kullanıcıya klasör seçtirir,
 *    seçilen klasöre dosyayı doğrudan yazar → cihazın "Dosyalar" uygulamasında
 *    anında görünür. Kullanıcı klasör seçimini iptal ederse paylaş ekranına
 *    geri düşer (Samsung/One UI gibi cihazlarda paylaş listesinde "Dosyalara
 *    Kaydet" seçeneği her zaman görünmediği için bu fallback önemli).
 *
 *  • iOS: `Sharing.shareAsync` çağrılır — iOS paylaş ekranında "Files'a Kaydet"
 *    seçeneği her zaman yerleşik olarak bulunur.
 *
 * Her durumda JSON, uygulama önbelleğine de yazılır; bu kopya çağıran taraf
 * için referans (paylaşım, hata ayıklama, önizleme) amacıyla kullanılır.
 */
export async function exportBackupToFile(range: BackupDateRange): Promise<ExportResult> {
  const payload = await buildBackupPayload(range);
  const json = JSON.stringify(payload, null, 2);

  const fileName = `spark-backup_${payload.range.start}_${payload.range.end}.json`;
  const fileNameNoExt = fileName.replace(/\.json$/i, '');

  const file = new File(Paths.cache, fileName);
  if (file.exists) {
    try {
      file.delete();
    } catch {
      /* aynı dosya üzerine yazacağız */
    }
  }
  file.create({ overwrite: true });
  file.write(json);

  const itemCount = payload.data.expenses.reduce((n, e) => n + e.items.length, 0);
  const debtCount = payload.data.debts?.length ?? 0;
  const debtPaymentCount = payload.data.debt_payments?.length ?? 0;
  const incomeCount = payload.data.extra_incomes?.length ?? 0;
  const reminderCount = payload.data.recurring_payment_reminders?.length ?? 0;

  const result: ExportResult = {
    fileUri: file.uri,
    fileName,
    expenseCount: payload.data.expenses.length,
    itemCount,
    debtCount,
    debtPaymentCount,
    incomeCount,
    reminderCount,
    recordCount: payload.data.expenses.length + debtCount + debtPaymentCount
      + incomeCount + reminderCount,
    sizeBytes: file.size ?? json.length,
    destination: 'cancelled',
  };

  // Android — SAF ile doğrudan klasöre yaz. Kullanıcı iptal ederse paylaşıma düş.
  if (Platform.OS === 'android') {
    try {
      const SAF = FileSystemLegacy.StorageAccessFramework;
      const perm = await SAF.requestDirectoryPermissionsAsync();
      if (perm.granted) {
        const savedUri = await SAF.createFileAsync(
          perm.directoryUri,
          fileNameNoExt,
          'application/json',
        );
        await SAF.writeAsStringAsync(savedUri, json);
        result.savedUri = savedUri;
        result.destination = 'saved';
        return result;
      }
    } catch (e) {
      if (__DEV__) console.warn('SAF save failed, falling back to share', e);
    }
  }

  if (await Sharing.isAvailableAsync()) {
    await Sharing.shareAsync(file.uri, {
      mimeType: 'application/json',
      dialogTitle: 'S.P.A.R.K. backup',
      UTI: 'public.json',
    });
    result.destination = 'shared';
  }

  return result;
}

export interface ParsedBackup {
  payload: BackupPayload;
  fileName: string;
}

/** DocumentPicker ile JSON seçtirir; okur, parse eder ve şema doğrulaması yapar. */
export async function pickAndParseBackupFile(): Promise<ParsedBackup | null> {
  const res = await DocumentPicker.getDocumentAsync({
    type: ['application/json', 'application/*', '*/*'],
    copyToCacheDirectory: true,
    multiple: false,
  });
  if (res.canceled || !res.assets?.[0]) return null;
  const asset = res.assets[0];
  const file = new File(asset.uri);
  const declaredSize = typeof asset.size === 'number' ? asset.size : file.size;
  if (typeof declaredSize === 'number' && declaredSize > MAX_BACKUP_FILE_BYTES) {
    throw new Error('INVALID_FORMAT');
  }
  const raw = await file.text();
  if (raw.length > MAX_BACKUP_FILE_BYTES) throw new Error('INVALID_FORMAT');

  let parsed: unknown;
  try {
    parsed = JSON.parse(raw);
  } catch {
    throw new Error('INVALID_JSON');
  }
  if (parsed && typeof parsed === 'object') {
    stripDangerousKeys(parsed as Record<string, unknown>);
  }
  const payload = validateAndNormalizeBackupPayload(parsed);

  return { payload, fileName: asset.name ?? 'backup.json' };
}

/**
 * İçe aktarım. Tek SQLite transaction içinde çalışır; herhangi bir
 * adımda hata alınırsa tüm değişiklikler geri alınır.
 *
 * Yinelenen kayıt tespiti v3'te kaynak zaman damgası ve kanonik domain alanları
 * için tüketilebilir aday havuzlarıyla yapılır. Böylece aynı dosya idempotent
 * kalırken gerçekten ayrı fakat özdeş kayıtlar tek satıra düşürülmez.
 */
export async function importBackupPayload(inputPayload: BackupPayload): Promise<ImportSummary> {
  const payload = validateAndNormalizeBackupPayload(inputPayload);
  const db = await getDatabase();

  const summary: ImportSummary = {
    expensesAdded: 0,
    expensesSkipped: 0,
    itemsAdded: 0,
    categoriesAdded: 0,
    vendorsAdded: 0,
    budgetsAdded: 0,
    debtsAdded: 0,
    debtsSkipped: 0,
    debtPaymentsAdded: 0,
    debtPaymentsSkipped: 0,
    extraIncomesAdded: 0,
    extraIncomesSkipped: 0,
    remindersAdded: 0,
    remindersSkipped: 0,
  };

  await db.withTransactionAsync(async () => {
    // Önce mevcut kategorileri topla
    const existingCats = await db.getAllAsync<Category>('SELECT * FROM categories');
    const catKey = (name: string, parentId: number | null) =>
      `${(name || '').trim().toLowerCase()}::${parentId ?? 'root'}`;
    // Basit: tek harita — key = name+parentId
    const byKey = new Map<string, number>();
    for (const c of existingCats) byKey.set(catKey(c.name, c.parent_id), c.id);

    // Kategoriler: parent zinciri nedeniyle iki geçiş — önce kökler, sonra çocuklar
    const expCats = payload.data.categories || [];
    const rootNameToId = new Map<string, number>();
    for (const c of expCats) {
      if (c.parent_name) continue;
      const name = sanitizeText(c.name, 100);
      if (!name) continue;
      const key = catKey(name, null);
      let id = byKey.get(key);
      if (!id) {
        const icon = sanitizeText(c.icon || 'tag-outline', 100);
        const color = sanitizeText(c.color || '#7C6BFF', 20);
        const r = await db.runAsync(
          'INSERT INTO categories (name, icon, color, parent_id, is_system) VALUES (?, ?, ?, NULL, 0)',
          [name, icon, color]
        );
        id = Number(r.lastInsertRowId);
        byKey.set(key, id);
        summary.categoriesAdded += 1;
      }
      rootNameToId.set(name.toLowerCase(), id);
    }
    for (const c of expCats) {
      if (!c.parent_name) continue;
      const name = sanitizeText(c.name, 100);
      if (!name) continue;
      const parentIdFromPayload = rootNameToId.get(c.parent_name.toLowerCase());
      // Eğer payload içinde parent kayıtlı değilse, mevcut DB'deki kök ile eşlemeye çalış
      const existingRootId =
        parentIdFromPayload ?? byKey.get(catKey(c.parent_name, null)) ?? null;
      const key = catKey(name, existingRootId);
      let id = byKey.get(key);
      if (!id) {
        const icon = sanitizeText(c.icon || 'tag-outline', 100);
        const color = sanitizeText(c.color || '#7C6BFF', 20);
        const r = await db.runAsync(
          'INSERT INTO categories (name, icon, color, parent_id, is_system) VALUES (?, ?, ?, ?, 0)',
          [name, icon, color, existingRootId]
        );
        id = Number(r.lastInsertRowId);
        byKey.set(key, id);
        summary.categoriesAdded += 1;
      }
    }

    // Tüm kategorileri ad bazlı kısa yol — (isim → id). Çakışma olursa
    // yaprak > kök tercih edilir; pratikte expense.category_name çoğunlukla yaprak.
    const nameToId = new Map<string, number>();
    const refreshed = await db.getAllAsync<Category>('SELECT * FROM categories');
    for (const c of refreshed) {
      const k = (c.name || '').trim().toLowerCase();
      const existingMapped = nameToId.get(k);
      if (existingMapped == null) {
        nameToId.set(k, c.id);
      } else {
        // Eğer mevcut kök ama yeni yaprak ise yaprağı yeğle
        const cur = refreshed.find(x => x.id === existingMapped);
        if (cur && cur.parent_id == null && c.parent_id != null) {
          nameToId.set(k, c.id);
        }
      }
    }

    // Vendors — default_category_name v2+ için
    const vendorIdByName = new Map<string, number>();
    const existingVendors = await db.getAllAsync<Vendor>(
      'SELECT id, name, logo_uri, default_category_id, created_at FROM vendors'
    );
    for (const v of existingVendors) {
      vendorIdByName.set(v.name.trim().toLowerCase(), v.id);
    }
    for (const v of payload.data.vendors || []) {
      const name = sanitizeText(v.name, 200);
      if (!name) continue;
      const key = name.toLowerCase();
      const defaultCatId = v.default_category_name
        ? nameToId.get(v.default_category_name.trim().toLowerCase()) ?? null
        : null;
      if (vendorIdByName.has(key)) {
        // Mevcut satıcının default'u boşsa import'tan değer al — değilse dokunma
        if (defaultCatId != null) {
          const existingId = vendorIdByName.get(key)!;
          await db.runAsync(
            'UPDATE vendors SET default_category_id = COALESCE(default_category_id, ?) WHERE id = ?',
            [defaultCatId, existingId]
          );
        }
        continue;
      }
      const r = await db.runAsync(
        'INSERT INTO vendors (name, logo_uri, default_category_id) VALUES (?, ?, ?)',
        [name, v.logo_uri ?? null, defaultCatId]
      );
      vendorIdByName.set(key, Number(r.lastInsertRowId));
      summary.vendorsAdded += 1;
    }

    // Expenses + items. Aday havuzu transaction başlamadan önce var olan
    // satırlardan kurulur ve her aday en fazla bir kaynak kaydı için tüketilir.
    // Böylece aynı gün/satıcı/tutar/not değerlerine sahip iki meşru işlem ilk
    // importta birbirini yutmaz; aynı v3 dosyası tekrar geldiğinde de kararlı
    // created_at + domain anahtarıyla ayrı hedef satırlara eşlenir.
    const existingExpenses = await db.getAllAsync<{
      id: number;
      vendor_id: number | null;
      category_id: number | null;
      total_amount: number;
      currency: string;
      note: string | null;
      date: string;
      created_at: string;
    }>(
      `SELECT id, vendor_id, category_id, total_amount, currency, note, date, created_at
         FROM expenses ORDER BY id ASC`,
    );
    const expenseKey = (
      version: number,
      value: {
        vendorId: number | null;
        categoryId: number | null;
        total: number;
        currency: string;
        note: string | null;
        date: string;
        createdAt?: string | null;
      },
    ): string => version >= 3
      ? JSON.stringify([
          value.createdAt,
          value.date,
          toMinorUnits(value.total),
          value.currency,
          value.vendorId,
          value.categoryId,
          value.note ?? '',
        ])
      : JSON.stringify([
          value.date,
          toMinorUnits(value.total),
          value.vendorId,
          value.note ?? '',
        ]);
    const existingExpensePools = new Map<string, number[]>();
    for (const existing of existingExpenses) {
      const key = expenseKey(payload.version, {
        vendorId: existing.vendor_id,
        categoryId: existing.category_id,
        total: existing.total_amount,
        currency: existing.currency,
        note: existing.note,
        date: existing.date,
        createdAt: existing.created_at,
      });
      const pool = existingExpensePools.get(key) ?? [];
      pool.push(existing.id);
      existingExpensePools.set(key, pool);
    }

    const expenseIdBySource = new Map<number, number>();
    for (const exp of payload.data.expenses || []) {
      const date = sanitizeDate(exp.date);
      if (!date) { summary.expensesSkipped += 1; continue; }
      const total = sanitizeAmount(exp.total_amount);
      const currency = sanitizeText(exp.currency || 'PLN', 10);
      const note = exp.note ? sanitizeText(exp.note, 1000) : null;
      const receiptUri = exp.receipt_uri && typeof exp.receipt_uri === 'string'
        ? sanitizeText(exp.receipt_uri, 2000) : null;

      const vendorId = exp.vendor_name
        ? vendorIdByName.get(exp.vendor_name.trim().toLowerCase()) ?? null
        : null;
      const categoryId = exp.category_name
        ? nameToId.get(exp.category_name.trim().toLowerCase()) ?? null
        : null;

      const key = expenseKey(payload.version, {
        vendorId,
        categoryId,
        total,
        currency,
        note,
        date,
        createdAt: exp.created_at ?? null,
      });
      const duplicatePool = existingExpensePools.get(key);
      const duplicateId = duplicatePool?.shift();
      if (duplicateId != null) {
        if (exp.source_id != null) expenseIdBySource.set(exp.source_id, duplicateId);
        summary.expensesSkipped += 1;
        continue;
      }

      const ins = payload.version >= 3
        ? await db.runAsync(
            `INSERT INTO expenses
               (vendor_id, category_id, total_amount, currency, note, receipt_uri, date, created_at)
             VALUES (?, ?, ?, ?, ?, ?, ?, ?)`,
            [vendorId, categoryId, total, currency, note, receiptUri, date, exp.created_at!],
          )
        : await db.runAsync(
            `INSERT INTO expenses
               (vendor_id, category_id, total_amount, currency, note, receipt_uri, date)
             VALUES (?, ?, ?, ?, ?, ?, ?)`,
            [vendorId, categoryId, total, currency, note, receiptUri, date],
          );
      const expenseId = Number(ins.lastInsertRowId);
      if (exp.source_id != null) expenseIdBySource.set(exp.source_id, expenseId);
      summary.expensesAdded += 1;

      for (const it of exp.items || []) {
        const itemName = sanitizeText(it.name, 500) || 'Ürün';
        const itemTurkish = it.turkish_name ? sanitizeText(it.turkish_name, 500) : null;
        const qty = sanitizeQuantity(it.quantity);
        const unit = sanitizeUnitPrice(it.unit_price);
        const tp = roundMoney(sanitizeUnitPrice(it.total_price));
        const ld = it.line_discount != null ? sanitizeAmount(it.line_discount) : 0;
        const lb = it.list_line_total_before_discount != null
          ? sanitizeAmount(it.list_line_total_before_discount) : null;
        const itemCatId = it.category_name
          ? nameToId.get(it.category_name.trim().toLowerCase()) ?? null
          : null;
        await db.runAsync(
          `INSERT INTO expense_items
             (expense_id, name, turkish_name, quantity, measurement_unit, unit_price, total_price, category_id, line_discount, list_line_total_before_discount)
           VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`,
          [expenseId, itemName, itemTurkish, qty, sanitizeMeasurementUnit(it.measurement_unit), unit, tp, itemCatId, ld, lb]
        );
        summary.itemsAdded += 1;
      }
    }

    // v2+: Dismissed abonelikler — aktif türetilmiş abonelikler tekrar
    // üretilebilir; kullanıcının reddi ise vendor eşlemesiyle korunur.
    const dismissed = payload.data.dismissed_subscriptions;
    if (dismissed.length > 0) {
      const nowIso = new Date().toISOString();
      for (const entry of dismissed) {
        const vendorName = entry.vendor_name.trim().toLowerCase();
        if (!vendorName) continue;
        const vendorId = vendorIdByName.get(vendorName);
        if (!vendorId) continue;
        await db.runAsync(
          `INSERT INTO subscriptions
             (vendor_id, amount, currency, period_days, last_seen_date,
              next_expected_date, occurrences, status, updated_at)
           VALUES (?, 0, '', 30, ?, ?, 0, 'dismissed', ?)
           ON CONFLICT(vendor_id) DO UPDATE SET
             status = 'dismissed', updated_at = excluded.updated_at`,
          [vendorId, nowIso.slice(0, 10), nowIso.slice(0, 10), nowIso],
        );
      }
    }

    // Debts — kaynak kimlikler yalnız payload-içi eşlemedir. Hedef PK her
    // zaman SQLite tarafından üretilir; linked expense yeni/duplicate map'ten gelir.
    const debtIdBySource = new Map<number, number>();
    const touchedDebtIds = new Set<number>();
    const debtKey = (value: {
      createdAt: string;
      direction: string;
      counterparty: string;
      amount: number;
      currency: string;
      date: string;
      dueDate: string | null;
      reminderEnabled: boolean | number;
      reminderDaysBefore: number;
      reminderTime: string;
      linkedExpenseId: number | null;
      note: string | null;
    }, includeLinkedExpense: boolean): string => JSON.stringify([
      value.createdAt,
      value.direction,
      value.counterparty,
      toMinorUnits(value.amount),
      value.currency,
      value.date,
      value.dueDate,
      value.reminderEnabled ? 1 : 0,
      value.reminderDaysBefore,
      value.reminderTime,
      value.note,
      ...(includeLinkedExpense ? [value.linkedExpenseId] : []),
    ]);
    const existingDebts = await db.getAllAsync<{
      id: number;
      direction: string;
      counterparty: string;
      amount: number;
      remaining: number;
      currency: string;
      date: string;
      status: string;
      due_date: string | null;
      reminder_enabled: number;
      reminder_days_before: number;
      reminder_time: string;
      linked_expense_id: number | null;
      note: string | null;
      created_at: string;
    }>(
      `SELECT id, direction, counterparty, amount, remaining, currency, date,
              status, due_date,
              reminder_enabled, reminder_days_before, reminder_time,
              linked_expense_id, note, created_at
         FROM debts ORDER BY id ASC`,
    );
    const debtExactPools = new Map<string, number[]>();
    const debtWithoutLinkPools = new Map<string, number[]>();
    const consumedDebtIds = new Set<number>();
    for (const existing of existingDebts) {
      const canonical = {
        createdAt: existing.created_at,
        direction: existing.direction,
        counterparty: existing.counterparty,
        amount: existing.amount,
        currency: existing.currency,
        date: existing.date,
        dueDate: existing.due_date,
        reminderEnabled:
          existing.status === 'open' && toMinorUnits(existing.remaining) > 0
            ? existing.reminder_enabled
            : 0,
        reminderDaysBefore: existing.reminder_days_before,
        reminderTime: existing.reminder_time,
        linkedExpenseId: existing.linked_expense_id,
        note: existing.note,
      };
      addPoolCandidate(debtExactPools, debtKey(canonical, true), existing.id);
      addPoolCandidate(debtWithoutLinkPools, debtKey(canonical, false), existing.id);
    }
    for (const debt of payload.data.debts) {
      const linkedExpenseId = debt.linked_expense_source_id == null
        ? null
        : expenseIdBySource.get(debt.linked_expense_source_id) ?? null;
      const amount = sanitizeAmount(debt.amount);
      const counterparty = sanitizeText(debt.counterparty, 200);
      const currency = sanitizeText(debt.currency || 'PLN', 10);
      const note = debt.note ? sanitizeText(debt.note, 1000) : null;
      const createdAt = sanitizeText(debt.created_at, 64);
      const canonical = {
        createdAt,
        direction: debt.direction,
        counterparty,
        amount,
        currency,
        date: debt.date,
        dueDate: debt.due_date,
        reminderEnabled: debt.reminder_enabled,
        reminderDaysBefore: debt.reminder_days_before,
        reminderTime: debt.reminder_time,
        linkedExpenseId,
        note,
      };
      const relationIsExact = !debt.linked_expense_relation_omitted;
      const key = debtKey(canonical, relationIsExact);

      let targetDebtId = takePoolCandidate(
        relationIsExact ? debtExactPools : debtWithoutLinkPools,
        key,
        consumedDebtIds,
      );
      if (targetDebtId != null) {
        summary.debtsSkipped += 1;
      } else {
        const inserted = await db.runAsync(
          `INSERT INTO debts
             (direction, counterparty, amount, remaining, currency, date, status,
              linked_expense_id, note, created_at, due_date, reminder_enabled,
              reminder_days_before, reminder_time)
           VALUES (?, ?, ?, ?, ?, ?, 'open', ?, ?, ?, ?, ?, ?, ?)`,
          [
            debt.direction,
            counterparty,
            amount,
            amount,
            currency,
            debt.date,
            linkedExpenseId,
            note,
            createdAt,
            debt.due_date,
            debt.reminder_enabled ? 1 : 0,
            debt.reminder_days_before,
            debt.reminder_time,
          ],
        );
        targetDebtId = Number(inserted.lastInsertRowId);
        summary.debtsAdded += 1;
      }
      debtIdBySource.set(debt.source_id, targetDebtId);
      touchedDebtIds.add(targetDebtId);
    }

    // Payload kendi içinde doğru olsa bile hedef DB'de daha yeni yerel ödemeler
    // bulunabilir. Birleşik geçmişin anaparayı aşmasına izin vermek nakit akışını
    // şişirir; bu yüzden union durumu ilk yeni ödeme yazılmadan önce izlenir.
    const debtAmountMinorByTarget = new Map<number, number>();
    const paidMinorByTarget = new Map<number, number>();
    for (const debtId of touchedDebtIds) {
      const debt = await db.getFirstAsync<{ amount: number }>(
        'SELECT amount FROM debts WHERE id = ?',
        [debtId],
      );
      if (!debt) invalidFormat();
      const paid = await db.getFirstAsync<{ total: number }>(
        'SELECT COALESCE(SUM(amount), 0) AS total FROM debt_payments WHERE debt_id = ?',
        [debtId],
      );
      const amountMinor = toMinorUnits(debt.amount);
      const paidMinor = toMinorUnits(paid?.total ?? 0);
      if (paidMinor > amountMinor) invalidFormat();
      debtAmountMinorByTarget.set(debtId, amountMinor);
      paidMinorByTarget.set(debtId, paidMinor);
    }

    // Payments — aynı parent/tarih/tutar/zaman imzasının her örneği havuzdan en
    // fazla bir kez tüketilir. Özdeş iki gerçek ödeme ayrı kalır.
    const paymentKey = (value: {
      debtId: number;
      createdAt: string;
      amount: number;
      date: string;
    }): string => JSON.stringify([
      value.debtId,
      value.createdAt,
      toMinorUnits(value.amount),
      value.date,
    ]);
    const existingPayments = await db.getAllAsync<{
      id: number;
      debt_id: number;
      amount: number;
      date: string;
      created_at: string;
    }>(
      `SELECT id, debt_id, amount, date, created_at
         FROM debt_payments ORDER BY id ASC`,
    );
    const paymentPools = new Map<string, number[]>();
    for (const existing of existingPayments) {
      addPoolCandidate(paymentPools, paymentKey({
        debtId: existing.debt_id,
        createdAt: existing.created_at,
        amount: existing.amount,
        date: existing.date,
      }), existing.id);
    }
    for (const payment of payload.data.debt_payments) {
      const debtId = debtIdBySource.get(payment.debt_source_id);
      if (!debtId) invalidFormat();
      const amount = sanitizeAmount(payment.amount);
      const createdAt = sanitizeText(payment.created_at, 64);
      const key = paymentKey({ debtId, createdAt, amount, date: payment.date });
      if (takePoolCandidate(paymentPools, key) != null) {
        summary.debtPaymentsSkipped += 1;
        continue;
      }
      const nextPaidMinor = (paidMinorByTarget.get(debtId) ?? 0) + toMinorUnits(amount);
      if (nextPaidMinor > (debtAmountMinorByTarget.get(debtId) ?? 0)) invalidFormat();
      await db.runAsync(
        'INSERT INTO debt_payments (debt_id, amount, date, created_at) VALUES (?, ?, ?, ?)',
        [debtId, amount, payment.date, createdAt],
      );
      paidMinorByTarget.set(debtId, nextPaidMinor);
      summary.debtPaymentsAdded += 1;
    }

    // `remaining` ve `status` backup'tan alınmaz; hedef DB'nin kanonik ödeme
    // satırlarından kuruş bazında yeniden türetilir.
    for (const debtId of touchedDebtIds) {
      const amountMinor = debtAmountMinorByTarget.get(debtId);
      const paidMinor = paidMinorByTarget.get(debtId);
      if (amountMinor == null || paidMinor == null) invalidFormat();
      const remaining = fromMinorUnits(amountMinor - paidMinor);
      await db.runAsync(
        `UPDATE debts
            SET remaining = ?,
                status = ?,
                reminder_enabled = CASE WHEN ? = 0 THEN 0 ELSE reminder_enabled END
          WHERE id = ?`,
        [remaining, remaining === 0 ? 'settled' : 'open', remaining, debtId],
      );
    }

    // Extra income — tüketilebilir havuz tekrar importu idempotent tutar ve
    // aynı anda oluşmuş özdeş iki gerçek geliri tek satıra düşürmez.
    const incomeKey = (value: {
      createdAt: string;
      source: string;
      amount: number;
      currency: string;
      date: string;
      note: string | null;
    }): string => JSON.stringify([
      value.createdAt,
      value.source,
      toMinorUnits(value.amount),
      value.currency,
      value.date,
      value.note,
    ]);
    const existingIncomes = await db.getAllAsync<{
      id: number;
      source: string;
      amount: number;
      currency: string;
      date: string;
      note: string | null;
      created_at: string;
    }>(
      `SELECT id, source, amount, currency, date, note, created_at
         FROM extra_incomes ORDER BY id ASC`,
    );
    const incomePools = new Map<string, number[]>();
    for (const existing of existingIncomes) {
      addPoolCandidate(incomePools, incomeKey({
        createdAt: existing.created_at,
        source: existing.source,
        amount: existing.amount,
        currency: existing.currency,
        date: existing.date,
        note: existing.note,
      }), existing.id);
    }
    for (const income of payload.data.extra_incomes) {
      const source = sanitizeText(income.source, 200);
      const amount = sanitizeAmount(income.amount);
      const currency = sanitizeText(income.currency || 'PLN', 10);
      const note = income.note ? sanitizeText(income.note, 1000) : null;
      const createdAt = sanitizeText(income.created_at, 64);
      const key = incomeKey({
        createdAt,
        source,
        amount,
        currency,
        date: income.date,
        note,
      });
      if (takePoolCandidate(incomePools, key) != null) {
        summary.extraIncomesSkipped += 1;
        continue;
      }
      await db.runAsync(
        `INSERT INTO extra_incomes (source, amount, currency, date, note, created_at)
         VALUES (?, ?, ?, ?, ?, ?)`,
        [source, amount, currency, income.date, note, createdAt],
      );
      summary.extraIncomesAdded += 1;
    }

    // Recurring reminder — UID taşınabilir logical kimliktir. Yalnız birebir
    // eşleşme atlanır; aynı UID'nin farklı içeriği veya detected-vendor tekillik
    // çakışması sessiz veri kaybı yerine tüm importu reddeder.
    for (const reminder of payload.data.recurring_payment_reminders) {
      const uid = normalizeCanonicalUuid(reminder.uid);
      if (!uid) invalidFormat();
      const vendorId = reminder.vendor_name
        ? vendorIdByName.get(reminder.vendor_name.trim().toLowerCase()) ?? null
        : null;
      const title = sanitizeText(reminder.title, 200);
      const expectedAmount = reminder.expected_amount == null
        ? null
        : sanitizeAmount(reminder.expected_amount);
      const currency = sanitizeText(reminder.currency || 'PLN', 10);
      const note = reminder.note ? sanitizeText(reminder.note, 1000) : null;
      const createdAt = sanitizeText(reminder.created_at, 64);
      const updatedAt = sanitizeText(reminder.updated_at, 64);
      const existingByUid = await db.getFirstAsync<{
        id: number;
        uid: string;
        title: string;
        vendor_id: number | null;
        expected_amount: number | null;
        currency: string;
        anchor_date: string;
        next_due_date: string;
        recurrence_unit: string;
        recurrence_interval: number;
        reminder_days_before: number;
        reminder_time: string;
        status: string;
        source: string;
        note: string | null;
        created_at: string;
        updated_at: string;
      }>(
        'SELECT * FROM recurring_payment_reminders WHERE uid = ? LIMIT 1',
        [uid],
      );
      if (existingByUid) {
        const exact = existingByUid.uid === uid
          && existingByUid.title === title
          && existingByUid.vendor_id === vendorId
          && (existingByUid.expected_amount == null
            ? expectedAmount == null
            : expectedAmount != null
              && toMinorUnits(existingByUid.expected_amount) === toMinorUnits(expectedAmount))
          && existingByUid.currency === currency
          && existingByUid.anchor_date === reminder.anchor_date
          && existingByUid.next_due_date === reminder.next_due_date
          && existingByUid.recurrence_unit === reminder.recurrence_unit
          && existingByUid.recurrence_interval === reminder.recurrence_interval
          && existingByUid.reminder_days_before === reminder.reminder_days_before
          && existingByUid.reminder_time === reminder.reminder_time
          && existingByUid.status === reminder.status
          && existingByUid.source === reminder.source
          && (existingByUid.note ?? null) === note
          && existingByUid.created_at === createdAt
          && existingByUid.updated_at === updatedAt;
        if (!exact) invalidFormat();
        summary.remindersSkipped += 1;
        continue;
      }
      if (reminder.source === 'detected' && vendorId != null) {
        const existingDetected = await db.getFirstAsync<{ id: number }>(
          `SELECT id FROM recurring_payment_reminders
            WHERE source = 'detected' AND vendor_id = ? LIMIT 1`,
          [vendorId],
        );
        if (existingDetected) invalidFormat();
      }
      await db.runAsync(
        `INSERT INTO recurring_payment_reminders
           (uid, title, vendor_id, expected_amount, currency, anchor_date,
            next_due_date, recurrence_unit, recurrence_interval,
            reminder_days_before, reminder_time, status, source, note,
            created_at, updated_at)
         VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`,
        [
          uid,
          title,
          vendorId,
          expectedAmount,
          currency,
          reminder.anchor_date,
          reminder.next_due_date,
          reminder.recurrence_unit,
          reminder.recurrence_interval,
          reminder.reminder_days_before,
          reminder.reminder_time,
          reminder.status,
          reminder.source,
          note,
          createdAt,
          updatedAt,
        ],
      );
      summary.remindersAdded += 1;
    }

    // Budgets (ay anahtarında bütçe yoksa ekle — mevcut değeri asla ezmez)
    for (const b of payload.data.budgets || []) {
      const month = typeof b.start_date === 'string' && /^\d{4}-\d{2}$/.test(b.start_date)
        ? b.start_date : null;
      if (!month) continue;
      const existing = await db.getFirstAsync<{ id: number }>(
        `SELECT id FROM budgets
         WHERE active = 1 AND (period_start = ? OR (period_start IS NULL AND start_date = ?))
         LIMIT 1`,
        [b.period_start ?? null, month]
      );
      if (existing) continue;
      const amount = sanitizeAmount(b.monthly_amount);
      const curr = sanitizeText(b.currency || 'PLN', 10);
      await db.runAsync(
        `INSERT INTO budgets
          (monthly_amount, currency, start_date, period_start, period_end, cycle_start_day, active)
         VALUES (?, ?, ?, ?, ?, ?, 1)`,
        [
          amount,
          curr,
          month,
          b.period_start ?? null,
          b.period_end ?? null,
          b.cycle_start_day ?? null,
        ]
      );
      summary.budgetsAdded += 1;
    }
  });

  return summary;
}

/** Kolaylaştırıcı: dosyayı seç + parse et + import et. */
export async function pickAndImportBackup(): Promise<{
  summary: ImportSummary;
  fileName: string;
} | null> {
  const parsed = await pickAndParseBackupFile();
  if (!parsed) return null;
  const summary = await importBackupPayload(parsed.payload);
  return { summary, fileName: parsed.fileName };
}
