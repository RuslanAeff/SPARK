import { purgeBackupCopies, retainActiveExport, releaseActiveExport } from './temporaryFiles';
import { readBoundedBackup } from './boundedBackupReader';
// S.P.A.R.K. — Export / Import (backup) service
// Tarih aralığı bazlı yedek alma ve geri yükleme. Tüm işlemler tek
// SQLite transaction içinde atomik yürütülür; kısmi import riski yoktur.
//
// JSON format: { version, app, exportedAt, range:{start,end}, data:{...} }
// v4 içerik: giderler/kalemler, ilişkili satıcı-kategoriler, aralıktaki bütçe,
// borç/ödeme closure'ı, ek gelir ve tarih aralığından bağımsız kullanıcı ödeme
// hatırlatıcıları; ayrıca seçili kalemlerin kanonik ürün/alias closure'ı.
// Görsel/fiş dosyaları ve native bildirim kimlikleri taşınmaz.
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
import { relabelCurrencyRowsToAppCurrency } from '../db/appCurrencyDao';
import { getDatabase } from '../db/database';
import { getToday } from '../utils/dateUtils';
import { nameIdentityKey } from '../utils/searchText';
import {
  BACKUP_WRONG_PASSWORD,
  decryptBackupEnvelope,
  encryptBackupJson,
  isEncryptedBackupEnvelope,
} from './backupEncryption';
import {
  CanonicalProduct,
  Category,
  Expense,
  ExpenseItem,
  ProductAlias,
  Vendor,
  BudgetRollover,
  ContainerDepositVoucher,
  ContainerDepositRecovery,
} from '../db/schema';
import { expandRolloverRange } from '../utils/rolloverBackup';
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
import { isVoucherDateRangeValid, matchesVoucherRedemption } from '../utils/containerVoucherRules';
import { safeCategoryColor, safeCategoryIcon } from '../utils/categoryAppearance';
import { isRecurringOccurrence } from '../utils/recurringSchedule';
import { sanitizeMeasurementUnit } from '../utils/measurementUnit';
import { logError } from '../utils/logError';

/** Mevcut yedek formatı sürümü.
 *  v1 → ilk sürüm
 *  v2 → vendors.default_category_name + dismissed subscriptions
 *  v3 → borçlar/ödemeler, ek gelirler ve kullanıcı tanımlı ödeme hatırlatıcıları
 *  v4 → UUID tabanlı kanonik ürünler, alias kararları ve kalem bağlantıları
 *  v5 → bütçe devirleri
 *  v6 → şişe depozitoları, voucher'lar ve geri kazanım olayları
 *  v7 → harcama/borç/ödeme/ek gelir kalıcı kimliği (uid) ve kategori üst adı
 *       (BUG-21); birikim hedefi, kategori limitleri ve döngü günü (BUG-31)
 *
 * Yeni alanlar v1-v3 importunda boş dizilere normalize edilir. Eski uygulamalar
 * v4 dosyasını `UNSUPPORTED_VERSION` ile bilinçli biçimde reddeder. */
export const BACKUP_FORMAT_VERSION = 7;

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
  extends Omit<ExpenseItem, 'id' | 'expense_id' | 'category_id' | 'canonical_product_id'> {
  /** v4+: yalnız payload içi item eşlemesi için; hedef DB PK'si değildir. */
  source_id?: number;
  /** v4+: yerel canonical_product_id yerine taşınabilir ürün kimliği. */
  canonical_product_uid?: string | null;
  category_name?: string | null;
  /** v7+: aynı adlı alt kategorileri ayırmak için üst kategori adı (kökte null). */
  category_parent_name?: string | null;
}

interface ExportedCanonicalProduct {
  uid: string;
  canonical_name: string;
  canonical_key: string;
  measurement_unit: 'piece' | 'kg' | 'l';
  brand: string | null;
  variant: string | null;
  package_descriptor: string | null;
  created_at: string;
  updated_at: string;
}

interface ExportedProductAlias {
  canonical_product_uid: string;
  normalized_alias: string;
  measurement_unit: 'piece' | 'kg' | 'l';
  source: 'deterministic' | 'ai' | 'user';
  confidence: number | null;
  created_at: string;
}

interface ExportedExpense {
  /** v3+: yalnız bu payload içindeki FK eşlemeleri için; hedef DB PK'si değildir. */
  source_id?: number;
  /** v7+: taşınabilir kalıcı kimlik; tekrar içe aktarımda önce bununla eşleşir. */
  uid?: string;
  /** v3+: aynı dosyanın tekrar importunda meşru özdeş işlemleri ayırmaya yardım eder. */
  created_at?: string;
  date: string;
  total_amount: number;
  currency: string;
  note: string | null;
  receipt_uri: string | null;
  container_deposit_paid?: number;
  container_voucher_used?: number;
  vendor_name: string | null;
  category_name: string | null;
  /** v7+: üst kategori adı (kökte null). */
  category_parent_name?: string | null;
  items: ExportedExpenseItem[];
}

interface ExportedContainerDepositVoucher extends Omit<ContainerDepositVoucher, 'id' | 'redemption_expense_id'> {
  redemption_expense_source_id: number | null;
}

interface ExportedContainerDepositRecovery extends Omit<ContainerDepositRecovery, 'id' | 'voucher_id' | 'expense_id'> {
  voucher_uid: string | null;
  expense_source_id: number | null;
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
  /** v7+ */
  uid?: string;
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
  /** v7+ */
  uid?: string;
  debt_source_id: number;
  amount: number;
  date: string;
  created_at: string;
}

interface ExportedExtraIncome {
  source_id: number;
  /** v7+ */
  uid?: string;
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

/** v7+: tek birikim hedefi (BUG-31). */
interface ExportedSavingsGoal {
  title: string;
  target_amount: number;
  target_date: string;
  currency: string;
  current_amount: number;
}

/** v7+: bütçe döngüsü anahtarına (döngünün başladığı ay) bağlı kategori limiti (BUG-22/31). */
interface ExportedCategoryLimit {
  category_name: string;
  category_parent_name: string | null;
  month: string;
  limit_amount: number;
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
    /** v4+: v1-v3 uyumluluğu için tipte opsiyonel, v4 doğrulamasında zorunlu. */
    canonical_products?: ExportedCanonicalProduct[];
    product_aliases?: ExportedProductAlias[];
    /** v5: carryovers with full connected period history included in range. */
    budget_rollovers?: BudgetRollover[];
    /** v6: refundable-container voucher wallet and realized recoveries. */
    container_deposit_vouchers?: ExportedContainerDepositVoucher[];
    container_deposit_recoveries?: ExportedContainerDepositRecovery[];
    /** v7 (BUG-31): aralıktan bağımsız tek hedef; yoksa null. */
    savings_goal?: ExportedSavingsGoal | null;
    /** v7 (BUG-31): aralıkla kesişen döngülerin limitleri. */
    category_limits?: ExportedCategoryLimit[];
    /** v7 (BUG-31): kullanıcı ayarladıysa bütçe döngüsü başlangıç günü. */
    budget_cycle_start_day?: number | null;
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
  canonicalProductCount: number;
  productAliasCount: number;
  /** Fiş kalemleri dışındaki taşınabilir finansal/yapılandırma kayıtlarının toplamı. */
  recordCount: number;
  sizeBytes: number;
  destination: ExportDestination;
  /** SEC-01: dosya parolayla şifrelendi mi. */
  encrypted?: boolean;
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
  canonicalProductsAdded: number;
  canonicalProductsSkipped: number;
  productAliasesAdded: number;
  productAliasesSkipped: number;
  itemCanonicalLinksAdded: number;
  /** v5: bütçe devirleri ayrı bir finansal kayıt türüdür; harcama/gelir sayımına karışmaz. */
  rolloversAdded: number;
  rolloversSkipped: number;
  depositVouchersAdded: number;
  depositVouchersSkipped: number;
  depositRecoveriesAdded: number;
  depositRecoveriesSkipped: number;
  /**
   * BUG-20 (ürün kararı A): aynı kimlikli kayıt cihazda yedekten sonra değişmişse
   * (kupon süresi doldu, hatırlatıcı vadesi ilerledi, ürün yeniden adlandırıldı,
   * kalem düzenlendi...) cihazdaki hâli korunur ve içe aktarım sürer. Bu sayaç o
   * kayıtları sayar; ayrıca ilgili "Skipped" sayacında da yer alırlar.
   */
  keptLocal: number;
  /** v7 (BUG-31): cihazda hedef yokken yedekteki hedef yüklendi (0/1). */
  savingsGoalAdded: number;
  categoryLimitsAdded: number;
  categoryLimitsSkipped: number;
  /** v7 (BUG-31): cihazda döngü günü ayarı yokken yedekteki yüklendi (0/1). */
  cycleDayRestored: number;
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
    canonical_products: ExportedCanonicalProduct[];
    product_aliases: ExportedProductAlias[];
    budget_rollovers: BudgetRollover[];
    container_deposit_vouchers: ExportedContainerDepositVoucher[];
    container_deposit_recoveries: ExportedContainerDepositRecovery[];
    savings_goal: ExportedSavingsGoal | null;
    category_limits: ExportedCategoryLimit[];
    budget_cycle_start_day: number | null;
  };
};

/** Doğrulayıcının o an denetlediği koleksiyon; hata mesajını zenginleştirir (BUG-19). */
export type BackupValidationSection =
  | 'root'
  | 'expenses'
  | 'categories'
  | 'vendors'
  | 'budgets'
  | 'dismissed_subscriptions'
  | 'debts'
  | 'debt_payments'
  | 'extra_incomes'
  | 'recurring_payment_reminders'
  | 'canonical_products'
  | 'product_aliases'
  | 'budget_rollovers'
  | 'container_deposit_vouchers'
  | 'container_deposit_recoveries'
  | 'savings_goal'
  | 'category_limits'
  | 'budget_cycle_start_day';

// Doğrulama tamamen senkron olduğu için modül düzeyi durum güvenlidir.
let validationSection: BackupValidationSection = 'root';

function section(name: BackupValidationSection): void {
  validationSection = name;
}

/** Mesaj her zaman `INVALID_FORMAT` kalır; `section` yalnız tanılama içindir. */
function invalidFormat(): never {
  throw Object.assign(new Error('INVALID_FORMAT'), { section: validationSection });
}

/** Dışa aktarım öz denetimi hata kodları (BUG-19). */
export const BACKUP_EXPORT_INVALID = 'BACKUP_EXPORT_INVALID';
export const BACKUP_EXPORT_TOO_LARGE = 'BACKUP_EXPORT_TOO_LARGE';

function utf8ByteLength(value: string): number {
  let bytes = 0;
  for (let i = 0; i < value.length; i++) {
    const code = value.charCodeAt(i);
    if (code < 0x80) bytes += 1;
    else if (code < 0x800) bytes += 2;
    else if (code >= 0xd800 && code <= 0xdbff && i + 1 < value.length) {
      bytes += 4;
      i++;
    } else bytes += 3;
  }
  return bytes;
}

/**
 * Dışa aktarılacak JSON'u, içe aktarımın uyguladığı aynı sözleşmeden geçirir.
 * Geri yüklenemeyecek bir dosyanın "yedek alındı" gibi görünmesini engeller:
 * veritabanı Google yedeğine girmediği için bu dosya çoğu zaman tek yedektir.
 */
export function assertBackupJsonRestorable(json: string): void {
  if (utf8ByteLength(json) > MAX_BACKUP_FILE_BYTES) {
    throw new Error(BACKUP_EXPORT_TOO_LARGE);
  }
  try {
    validateAndNormalizeBackupPayload(JSON.parse(json));
  } catch (error) {
    const failedSection = (error as { section?: BackupValidationSection } | null)?.section ?? 'root';
    if (__DEV__) console.warn('[backup] export self-check failed', failedSection, error);
    throw Object.assign(new Error(BACKUP_EXPORT_INVALID), { section: failedSection });
  }
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

// SQLite `datetime('now')` ("2026-11-11 10:00:00") ve JS `toISOString()` biçimleri.
// `Date.parse` boşluk ayraçlı biçimi her JS motorunda (ör. Hermes) garanti etmediği
// için önce motordan bağımsız düzenli ifade denenir; eski yol yedek olarak kalır.
const TIMESTAMP_PATTERN =
  /^(\d{4})-(\d{2})-(\d{2})[T ](\d{2}):(\d{2}):(\d{2})(?:\.\d{1,9})?(?:Z|[+-]\d{2}:?\d{2})?$/;

function isStructuredTimestamp(value: string): boolean {
  const match = TIMESTAMP_PATTERN.exec(value);
  if (!match) return false;
  return isStrictDate(`${match[1]}-${match[2]}-${match[3]}`)
    && Number(match[4]) <= 23
    && Number(match[5]) <= 59
    && Number(match[6]) <= 59;
}

function isIsoTimestamp(value: unknown): value is string {
  return typeof value === 'string'
    && value.length <= 64
    && (isStructuredTimestamp(value) || Number.isFinite(Date.parse(value)));
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
  section('root');
  const expenses = asBoundedArray(data.expenses);
  const categories = asBoundedArray(data.categories);
  const vendors = asBoundedArray(data.vendors);
  const budgets = asBoundedArray(data.budgets);
  let itemCount = 0;

  section('expenses');
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
        || !isNullableBoundedString(item.user_label, 500)
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

  section('categories');
  for (const raw of categories) {
    const category = asRecord(raw);
    if (!isBoundedString(category.name, 100, false)
      || !isBoundedString(category.icon, 100, false)
      || !isBoundedString(category.color, 20, false)
      || !isNullableBoundedString(category.parent_name, 100)) invalidFormat();
  }
  section('vendors');
  for (const raw of vendors) {
    const vendor = asRecord(raw);
    if (!isBoundedString(vendor.name, 200, false)
      || !isNullableBoundedString(vendor.logo_uri, 2000)
      || (vendor.default_category_name != null
        && !isBoundedString(vendor.default_category_name, 100))) invalidFormat();
  }
  section('budgets');
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
    section('dismissed_subscriptions');
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
  section('expenses');
  for (const expense of expenses) {
    if (!isPositiveInteger(expense.source_id)
      || expenseIds.has(expense.source_id)
      || !isIsoTimestamp(expense.created_at)) invalidFormat();
    expenseIds.add(expense.source_id);
  }

  const debtIds = new Set<number>();
  const debtAmountMinor = new Map<number, number>();
  section('debts');
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
  section('debt_payments');
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
  section('extra_incomes');
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
  section('recurring_payment_reminders');
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

function validateV4ProductIdentityCollections(data: Record<string, unknown>): void {
  const products = asBoundedArray(data.canonical_products);
  const aliases = asBoundedArray(data.product_aliases);
  const productByUid = new Map<string, { measurementUnit: string }>();

  section('canonical_products');
  for (const raw of products) {
    const product = asRecord(raw);
    const uid = normalizeCanonicalUuid(product.uid);
    if (!uid || productByUid.has(uid)
      || !isBoundedString(product.canonical_name, 500, false)
      || !isBoundedString(product.canonical_key, 500, false)
      || !['piece', 'kg', 'l'].includes(String(product.measurement_unit))
      || !isNullableBoundedString(product.brand, 200)
      || !isNullableBoundedString(product.variant, 200)
      || !isNullableBoundedString(product.package_descriptor, 200)
      || !isIsoTimestamp(product.created_at)
      || !isIsoTimestamp(product.updated_at)) invalidFormat();
    product.uid = uid;
    productByUid.set(uid, { measurementUnit: String(product.measurement_unit) });
  }

  const aliasKeys = new Set<string>();
  section('product_aliases');
  for (const raw of aliases) {
    const alias = asRecord(raw);
    const uid = normalizeCanonicalUuid(alias.canonical_product_uid);
    const product = uid ? productByUid.get(uid) : null;
    const measurementUnit = String(alias.measurement_unit);
    const confidence = alias.confidence == null ? null : numeric(alias.confidence);
    if (!uid || !product
      || !isBoundedString(alias.normalized_alias, 500, false)
      || !['piece', 'kg', 'l'].includes(measurementUnit)
      || product.measurementUnit !== measurementUnit
      || !['deterministic', 'ai', 'user'].includes(String(alias.source))
      || (confidence != null && (confidence < 0 || confidence > 1))
      || (alias.confidence != null && confidence == null)
      || !isIsoTimestamp(alias.created_at)) invalidFormat();
    alias.canonical_product_uid = uid;
    const aliasKey = `${measurementUnit}::${String(alias.normalized_alias)}`;
    if (aliasKeys.has(aliasKey)) invalidFormat();
    aliasKeys.add(aliasKey);
  }

  const itemSourceIds = new Set<number>();
  const expenses = data.expenses as Record<string, unknown>[];
  section('expenses');
  for (const expense of expenses) {
    for (const raw of expense.items as unknown[]) {
      const item = asRecord(raw);
      if (!isPositiveInteger(item.source_id) || itemSourceIds.has(item.source_id)) invalidFormat();
      itemSourceIds.add(item.source_id);
      if (item.canonical_product_uid == null) continue;
      const uid = normalizeCanonicalUuid(item.canonical_product_uid);
      const product = uid ? productByUid.get(uid) : null;
      const measurementUnit = String(item.measurement_unit ?? 'piece');
      if (!uid || !product || product.measurementUnit !== measurementUnit) invalidFormat();
      item.canonical_product_uid = uid;
    }
  }
}

/** Range-limited exports may omit a redeemed voucher's expense/recovery. */
function validateDepositRelations(
  expenses: ExportedExpense[],
  vouchers: ExportedContainerDepositVoucher[],
  recoveries: ExportedContainerDepositRecovery[],
): void {
  const expenseById = new Map(expenses.map(e => [e.source_id, e]));
  const voucherByUid = new Map(vouchers.map(v => [v.uid, v]));
  const recoveredVouchers = new Set<string>();
  const recoveredExpenses = new Set<number>();
  section('container_deposit_vouchers');
  for (const voucher of vouchers) {
    if (!isVoucherDateRangeValid(voucher.issued_date, voucher.expires_on)
      || (voucher.status === 'redeemed'
        ? voucher.redeemed_date == null
          || !matchesVoucherRedemption(voucher, { ...voucher, date: voucher.redeemed_date })
        : voucher.redeemed_date != null || voucher.redemption_expense_source_id != null)) invalidFormat();
  }
  section('container_deposit_recoveries');
  for (const recovery of recoveries) {
    const expense = recovery.expense_source_id == null ? null : expenseById.get(recovery.expense_source_id);
    if (recovery.expense_source_id != null) {
      if (recoveredExpenses.has(recovery.expense_source_id)) invalidFormat();
      recoveredExpenses.add(recovery.expense_source_id);
    }
    if (recovery.method === 'purchase_voucher') {
      if (!expense || expense.currency !== recovery.currency || expense.date !== recovery.date
        || toMinorUnits(expense.container_voucher_used ?? 0) !== toMinorUnits(recovery.amount)) invalidFormat();
    } else if (expense) invalidFormat();
    if (recovery.voucher_uid != null) {
      const voucher = voucherByUid.get(recovery.voucher_uid);
      if (!voucher || recoveredVouchers.has(voucher.uid)
        || voucher.status !== 'redeemed' || voucher.redeemed_date !== recovery.date
        || !matchesVoucherRedemption(voucher, recovery)
        || voucher.redemption_expense_source_id !== recovery.expense_source_id) invalidFormat();
      recoveredVouchers.add(voucher.uid);
    }
  }
  for (const expense of expenses) {
    if (Number(expense.container_voucher_used) > 0 && !recoveredExpenses.has(expense.source_id!)) invalidFormat();
  }
  section('container_deposit_vouchers');
  for (const voucher of vouchers) {
    if (voucher.redemption_expense_source_id != null && !recoveredVouchers.has(voucher.uid)) invalidFormat();
  }
}

/** Dosya ve doğrudan import yollarının kullandığı tek runtime sözleşmesi. */
export function validateAndNormalizeBackupPayload(input: unknown): NormalizedBackupPayload {
  try {
    return validateAndNormalizeBackupPayloadUnchecked(input);
  } finally {
    // Import'un sonraki çakışma hataları eski bölüm adını taşımasın.
    section('root');
  }
}

/**
 * BUG-21: v7'de harcama, borç, ödeme ve ek gelir zorunlu, dosya içinde tekil
 * bir UUID taşır; kategori üst adı isteğe bağlıdır. UID küçük harfe normalize edilir.
 */
function validateV7RecordIdentity(data: Record<string, unknown>): void {
  const collections: Array<[BackupValidationSection, unknown]> = [
    ['expenses', data.expenses],
    ['debts', data.debts],
    ['debt_payments', data.debt_payments],
    ['extra_incomes', data.extra_incomes],
  ];
  for (const [name, rows] of collections) {
    section(name);
    const seen = new Set<string>();
    for (const raw of asBoundedArray(rows)) {
      const row = asRecord(raw);
      const uid = normalizeCanonicalUuid(row.uid);
      if (!uid || seen.has(uid)) invalidFormat();
      seen.add(uid);
      row.uid = uid;
    }
  }
  section('expenses');
  for (const raw of data.expenses as unknown[]) {
    const expense = asRecord(raw);
    if (!isNullableBoundedString(expense.category_parent_name, 100)) invalidFormat();
    for (const rawItem of asBoundedArray(expense.items)) {
      if (!isNullableBoundedString(asRecord(rawItem).category_parent_name, 100)) invalidFormat();
    }
  }
}

/**
 * BUG-31: v7 hedef, kategori limitleri ve döngü günü. Alanlar isteğe bağlıdır
 * (yoksa "yedekte yok" sayılır); varsa canlı yazma yollarıyla aynı sınırlar.
 */
function validateV7Settings(data: Record<string, unknown>): void {
  section('savings_goal');
  if (data.savings_goal != null) {
    const goal = asRecord(data.savings_goal);
    if (!isBoundedString(goal.title, 200, false) || !String(goal.title).trim()
      || !isPositiveMoney(goal.target_amount)
      || !isStrictDate(goal.target_date)
      || !isBoundedString(goal.currency, 10, false)
      || !isNonNegativeMoney(goal.current_amount)) invalidFormat();
  }
  section('category_limits');
  if (data.category_limits != null) {
    const seen = new Set<string>();
    for (const raw of asBoundedArray(data.category_limits)) {
      const limit = asRecord(raw);
      if (!isBoundedString(limit.category_name, 100, false)
        || !isNullableBoundedString(limit.category_parent_name, 100)
        || !isMonthKey(limit.month)
        || !isPositiveMoney(limit.limit_amount)) invalidFormat();
      const key = JSON.stringify([
        String(limit.category_name).trim().toLowerCase(),
        limit.category_parent_name == null ? null : String(limit.category_parent_name).trim().toLowerCase(),
        limit.month,
      ]);
      if (seen.has(key)) invalidFormat();
      seen.add(key);
    }
  }
  section('budget_cycle_start_day');
  if (data.budget_cycle_start_day != null
    && (!Number.isInteger(data.budget_cycle_start_day)
      || Number(data.budget_cycle_start_day) < 1
      || Number(data.budget_cycle_start_day) > 31)) invalidFormat();
}

function validateAndNormalizeBackupPayloadUnchecked(input: unknown): NormalizedBackupPayload {
  section('root');
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
  if (root.version >= 4) {
    if (!Array.isArray(data.canonical_products)
      || !Array.isArray(data.product_aliases)) invalidFormat();
    validateV4ProductIdentityCollections(data);
  }
  if (root.version >= 5) {
    section('budget_rollovers');
    const seen = new Set<string>();
    const sources = new Set<string>();
    const budgets = data.budgets as ExportedBudget[];
    for (const value of asBoundedArray(data.budget_rollovers)) {
      const r = asRecord(value);
      if (!normalizeCanonicalUuid(r.uid) || seen.has(String(r.uid))
        || !isStrictDate(r.source_start) || !isStrictDate(r.source_end)
        || !isStrictDate(r.target_start) || !isStrictDate(r.target_end)
        || String(r.source_start) > String(r.source_end) || String(r.source_end) >= String(r.target_start)
        || String(r.target_start) > String(r.target_end)
        || typeof r.currency !== 'string' || !/^[A-Z]{3}$/.test(r.currency)
        || !Number.isSafeInteger(r.amount_minor) || Number(r.amount_minor) <= 0 || Number(r.amount_minor) > 99999999999
        || !isIsoTimestamp(r.created_at) || !isIsoTimestamp(r.updated_at)
        || String(r.source_start) < String(range.start) || String(r.target_end) > String(range.end)) invalidFormat();
      const nextDay = new Date(`${r.source_end}T12:00:00Z`);
      nextDay.setUTCDate(nextDay.getUTCDate() + 1);
      if (nextDay.toISOString().slice(0, 10) !== r.target_start) invalidFormat();
      const key = `${r.source_start}:${r.source_end}`;
      if (sources.has(key)) invalidFormat();
      sources.add(key); seen.add(String(r.uid));
      for (const [start, end] of [[r.source_start, r.source_end], [r.target_start, r.target_end]]) {
        const overlap = budgets.filter(b => b.period_start && b.period_end && b.period_start <= String(end) && b.period_end >= String(start));
        if (overlap.length !== 1 || overlap[0].period_start !== start || overlap[0].period_end !== end || overlap[0].currency !== r.currency) invalidFormat();
      }
    }
  }
  if (root.version >= 6) {
    section('expenses');
    const expenses = data.expenses as ExportedExpense[];
    const expenseIds = new Set(expenses.map(expense => expense.source_id));
    for (const expense of expenses) {
      if (!isNonNegativeMoney(expense.container_deposit_paid)
        || !isNonNegativeMoney(expense.container_voucher_used)
        || Number(expense.container_voucher_used) > Number(expense.total_amount)) invalidFormat();
      for (const item of expense.items) {
        if (!['product', 'container_deposit'].includes(String(item.financial_kind))) invalidFormat();
      }
    }
    const voucherUids = new Set<string>();
    section('container_deposit_vouchers');
    for (const raw of asBoundedArray(data.container_deposit_vouchers)) {
      const voucher = asRecord(raw);
      const uid = normalizeCanonicalUuid(voucher.uid);
      if (!uid || voucherUids.has(uid)
        || !isPositiveMoney(voucher.amount)
        || !isBoundedString(voucher.currency, 10, false)
        || !isStrictDate(voucher.issued_date)
        || (voucher.expires_on != null && !isStrictDate(voucher.expires_on))
        || !['available', 'redeemed', 'expired'].includes(String(voucher.status))
        || (voucher.redeemed_date != null && !isStrictDate(voucher.redeemed_date))
        || (voucher.redemption_expense_source_id != null
          && (!isPositiveInteger(voucher.redemption_expense_source_id)
            || !expenseIds.has(voucher.redemption_expense_source_id)))
        || !isNullableBoundedString(voucher.note, 1000)
        || !isIsoTimestamp(voucher.created_at)) invalidFormat();
      voucher.uid = uid;
      voucherUids.add(uid);
    }
    const recoveryUids = new Set<string>();
    section('container_deposit_recoveries');
    for (const raw of asBoundedArray(data.container_deposit_recoveries)) {
      const recovery = asRecord(raw);
      const uid = normalizeCanonicalUuid(recovery.uid);
      if (!uid || recoveryUids.has(uid)
        || (recovery.voucher_uid != null
          && (!normalizeCanonicalUuid(recovery.voucher_uid)
            || !voucherUids.has(String(recovery.voucher_uid).toLowerCase())))
        || (recovery.expense_source_id != null
          && (!isPositiveInteger(recovery.expense_source_id)
            || !expenseIds.has(recovery.expense_source_id)))
        || !isPositiveMoney(recovery.amount)
        || !isBoundedString(recovery.currency, 10, false)
        || !isStrictDate(recovery.date)
        || !['purchase_voucher', 'cash'].includes(String(recovery.method))
        || !isIsoTimestamp(recovery.created_at)) invalidFormat();
      recovery.uid = uid;
      if (recovery.voucher_uid != null) {
        recovery.voucher_uid = normalizeCanonicalUuid(recovery.voucher_uid);
      }
      recoveryUids.add(uid);
    }
    validateDepositRelations(
      expenses,
      data.container_deposit_vouchers as ExportedContainerDepositVoucher[],
      data.container_deposit_recoveries as ExportedContainerDepositRecovery[],
    );
  }

  if (root.version >= 7) {
    validateV7RecordIdentity(data);
    validateV7Settings(data);
  }

  return {
    ...(root as unknown as BackupPayload),
    data: {
      ...(data as unknown as BackupPayload['data']),
      vendors: (data.vendors as ExportedVendor[]).map(v => ({ ...v, logo_uri: null })),
      expenses: (data.expenses as ExportedExpense[]).map(e => ({ ...e, receipt_uri: null })),
      dismissed_subscriptions:
        (data.dismissed_subscriptions as ExportedDismissedSubscription[] | undefined) ?? [],
      debts: root.version >= 3 ? data.debts as ExportedDebt[] : [],
      debt_payments: root.version >= 3 ? data.debt_payments as ExportedDebtPayment[] : [],
      extra_incomes: root.version >= 3 ? data.extra_incomes as ExportedExtraIncome[] : [],
      recurring_payment_reminders: root.version >= 3
        ? data.recurring_payment_reminders as ExportedRecurringPaymentReminder[]
        : [],
      canonical_products: root.version >= 4
        ? data.canonical_products as ExportedCanonicalProduct[]
        : [],
      product_aliases: root.version >= 4
        ? data.product_aliases as ExportedProductAlias[]
        : [],
      budget_rollovers: root.version >= 5 ? data.budget_rollovers as BudgetRollover[] : [],
      container_deposit_vouchers: root.version >= 6
        ? data.container_deposit_vouchers as ExportedContainerDepositVoucher[]
        : [],
      container_deposit_recoveries: root.version >= 6
        ? data.container_deposit_recoveries as ExportedContainerDepositRecovery[]
        : [],
      savings_goal: root.version >= 7
        ? (data.savings_goal as ExportedSavingsGoal | null | undefined) ?? null
        : null,
      category_limits: root.version >= 7
        ? (data.category_limits as ExportedCategoryLimit[] | undefined) ?? []
        : [],
      budget_cycle_start_day: root.version >= 7
        ? (data.budget_cycle_start_day as number | null | undefined) ?? null
        : null,
    },
  };
}

export async function buildBackupPayload(range: BackupDateRange): Promise<BackupPayload> {
  assertValidRange(range);
  const db = await getDatabase();

  const allRollovers = await db.getAllAsync<BudgetRollover>('SELECT * FROM budget_rollovers ORDER BY source_start, uid');
  range = expandRolloverRange(range, allRollovers);
  const rolloversOut = allRollovers.filter(r => r.source_start >= range.start && r.target_end <= range.end);

  const expenses = await db.getAllAsync<
    Expense & { vendor_name: string | null; category_name: string | null; category_parent_name: string | null }
  >(
    `SELECT e.id, e.uid, e.vendor_id, e.category_id, e.total_amount, e.currency, e.note, e.receipt_uri,
            e.container_deposit_paid, e.container_voucher_used, e.date, e.created_at,
            v.name AS vendor_name, c.name AS category_name, cp.name AS category_parent_name
       FROM expenses e
       LEFT JOIN vendors v ON e.vendor_id = v.id
       LEFT JOIN categories c ON e.category_id = c.id
       LEFT JOIN categories cp ON c.parent_id = cp.id
      WHERE e.date BETWEEN ? AND ?
      ORDER BY e.date ASC, e.id ASC`,
    [range.start, range.end]
  );

  const vendorNames = new Set<string>();
  const categoryIds = new Set<number>();
  const canonicalProductUids = new Set<string>();

  // PERF-02: aralıktaki tüm kalemler TEK sorguda; eskiden harcama başına bir
  // sorgu çalışıyordu (3000 harcama = 3000 sorgu). Harcama filtresi yukarıdaki
  // sorguyla aynı olduğu için kapsam birebir aynıdır.
  type RawExportItem = ExpenseItem & {
    category_name?: string | null;
    category_parent_name?: string | null;
    canonical_product_uid?: string | null;
  };
  const itemsByExpense = new Map<number, RawExportItem[]>();
  for (const item of await db.getAllAsync<RawExportItem>(
    `SELECT i.*, c.name AS category_name, cp.name AS category_parent_name,
            p.uid AS canonical_product_uid
       FROM expense_items i
       JOIN expenses e ON e.id = i.expense_id
       LEFT JOIN categories c ON i.category_id = c.id
       LEFT JOIN categories cp ON c.parent_id = cp.id
       LEFT JOIN canonical_products p ON i.canonical_product_id = p.id
      WHERE e.date BETWEEN ? AND ?
      ORDER BY i.expense_id ASC, i.id ASC`,
    [range.start, range.end]
  )) {
    const bucket = itemsByExpense.get(item.expense_id);
    if (bucket) bucket.push(item);
    else itemsByExpense.set(item.expense_id, [item]);
  }

  const expensesOut: ExportedExpense[] = [];
  for (const exp of expenses) {
    if (exp.vendor_name) vendorNames.add(exp.vendor_name);
    if (exp.category_id != null) categoryIds.add(exp.category_id);

    const rawItems = itemsByExpense.get(exp.id) ?? [];

    const items: ExportedExpenseItem[] = rawItems.map(it => {
      if (it.category_id != null) categoryIds.add(it.category_id);
      if (it.canonical_product_uid) canonicalProductUids.add(it.canonical_product_uid);
      return {
        source_id: it.id,
        name: it.name,
        turkish_name: it.turkish_name ?? null,
        user_label: it.user_label ?? null,
        quantity: it.quantity,
        measurement_unit: sanitizeMeasurementUnit(it.measurement_unit),
        canonical_product_uid: it.canonical_product_uid ?? null,
        unit_price: it.unit_price,
        total_price: it.total_price,
        line_discount: it.line_discount ?? null,
        list_line_total_before_discount: it.list_line_total_before_discount ?? null,
        financial_kind: it.financial_kind === 'container_deposit' ? 'container_deposit' : 'product',
        category_name: it.category_name ?? null,
        category_parent_name: it.category_name != null ? it.category_parent_name ?? null : null,
      };
    });

    expensesOut.push({
      source_id: exp.id,
      uid: exp.uid!,
      created_at: exp.created_at,
      date: exp.date,
      total_amount: exp.total_amount,
      currency: exp.currency,
      note: exp.note,
      // SEC-01: yerel dosya yolu dışa aktarılmaz; içe aktarım bu alanı zaten NULL yapar.
      receipt_uri: null,
      container_deposit_paid: exp.container_deposit_paid ?? 0,
      container_voucher_used: exp.container_voucher_used ?? 0,
      vendor_name: exp.vendor_name ?? null,
      category_name: exp.category_name ?? null,
      category_parent_name: exp.category_name != null ? exp.category_parent_name ?? null : null,
      items,
    });
  }

  const depositExpenseIds = new Set(expenses.map(expense => expense.id));
  const depositVouchersOut = (await db.getAllAsync<ContainerDepositVoucher>(
    'SELECT * FROM container_deposit_vouchers ORDER BY issued_date ASC, id ASC',
  )).map<ExportedContainerDepositVoucher>(voucher => ({
    uid: voucher.uid,
    amount: voucher.amount,
    currency: voucher.currency,
    issued_date: voucher.issued_date,
    expires_on: voucher.expires_on,
    status: voucher.status,
    redeemed_date: voucher.redeemed_date,
    redemption_expense_source_id: voucher.redemption_expense_id != null
      && depositExpenseIds.has(voucher.redemption_expense_id)
      ? voucher.redemption_expense_id
      : null,
    note: voucher.note,
    created_at: voucher.created_at,
  }));
  const voucherUidById = new Map(
    (await db.getAllAsync<{ id: number; uid: string }>(
      'SELECT id, uid FROM container_deposit_vouchers',
    )).map(row => [row.id, row.uid] as const),
  );
  const depositRecoveriesOut = (await db.getAllAsync<ContainerDepositRecovery>(
    `SELECT * FROM container_deposit_recoveries
      WHERE date BETWEEN ? AND ? ORDER BY date ASC, id ASC`,
    [range.start, range.end],
  )).filter(recovery => recovery.expense_id == null || depositExpenseIds.has(recovery.expense_id))
    .map<ExportedContainerDepositRecovery>(recovery => ({
      uid: recovery.uid,
      voucher_uid: recovery.voucher_id == null ? null : voucherUidById.get(recovery.voucher_id) ?? null,
      expense_source_id: recovery.expense_id,
      amount: recovery.amount,
      currency: recovery.currency,
      date: recovery.date,
      method: recovery.method,
      created_at: recovery.created_at,
    }));

  // Tarih aralığının mahremiyetini korumak için yalnız seçili kalemlerin
  // referans verdiği ürünler ve bu ürünlere ait tüm öğrenilmiş alias'lar taşınır.
  const allCanonicalProducts = await db.getAllAsync<CanonicalProduct>(
    `SELECT id, uid, canonical_name, canonical_key, measurement_unit, brand,
            variant, package_descriptor, created_at, updated_at
       FROM canonical_products
      ORDER BY id ASC`,
  );
  const exportedCanonicalProductIds = new Set<number>();
  const canonicalProductsOut: ExportedCanonicalProduct[] = [];
  for (const product of allCanonicalProducts) {
    if (!canonicalProductUids.has(product.uid)) continue;
    exportedCanonicalProductIds.add(product.id);
    canonicalProductsOut.push({
      uid: product.uid,
      canonical_name: product.canonical_name,
      canonical_key: product.canonical_key,
      measurement_unit: sanitizeMeasurementUnit(product.measurement_unit),
      brand: product.brand ?? null,
      variant: product.variant ?? null,
      package_descriptor: product.package_descriptor ?? null,
      created_at: product.created_at,
      updated_at: product.updated_at,
    });
  }
  const allProductAliases = await db.getAllAsync<ProductAlias & { canonical_product_uid: string }>(
    `SELECT a.id, a.canonical_product_id, a.normalized_alias, a.measurement_unit,
            a.source, a.confidence, a.created_at, p.uid AS canonical_product_uid
       FROM product_aliases a
       JOIN canonical_products p ON p.id = a.canonical_product_id
      ORDER BY a.id ASC`,
  );
  const productAliasesOut: ExportedProductAlias[] = allProductAliases
    .filter(alias => exportedCanonicalProductIds.has(alias.canonical_product_id))
    .map(alias => ({
      canonical_product_uid: alias.canonical_product_uid,
      normalized_alias: alias.normalized_alias,
      measurement_unit: sanitizeMeasurementUnit(alias.measurement_unit),
      source: alias.source,
      confidence: alias.confidence ?? null,
      created_at: alias.created_at,
    }));

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
    uid: string;
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
    `SELECT d.id, d.uid, d.direction, d.counterparty, d.amount, d.remaining,
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
    uid: debt.uid,
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
    uid: string;
    debt_id: number;
    amount: number;
    date: string;
    created_at: string;
  }>(
    `SELECT p.id, p.uid, p.debt_id, p.amount, p.date, p.created_at
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
    uid: payment.uid,
    debt_source_id: payment.debt_id,
    amount: payment.amount,
    date: payment.date,
    created_at: payment.created_at,
  }));

  const incomeRows = await db.getAllAsync<{
    id: number;
    uid: string;
    source: string;
    amount: number;
    currency: string;
    date: string;
    note: string | null;
    created_at: string;
  }>(
    `SELECT id, uid, source, amount, currency, date, note, created_at
       FROM extra_incomes
      WHERE date BETWEEN ? AND ?
      ORDER BY date ASC, id ASC`,
    [range.start, range.end],
  );
  const extraIncomesOut: ExportedExtraIncome[] = incomeRows.map(income => ({
    source_id: income.id,
    uid: income.uid,
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
      // SEC-01: yerel dosya yolu dışa aktarılmaz; içe aktarım bu alanı zaten NULL yapar.
      logo_uri: null,
      default_category_name: vendor.default_category_name ?? null,
    });
  }

  // BUG-31: birikim hedefi, aralıkla kesişen döngülerin kategori limitleri ve
  // döngü günü. Yeni cihaza geri yüklemede bunlar kaybolmasın.
  const goalRow = await db.getFirstAsync<ExportedSavingsGoal>(
    `SELECT title, target_amount, target_date, currency, current_amount
       FROM savings_goal WHERE id = 1`,
  );
  const savingsGoalOut: ExportedSavingsGoal | null = goalRow && goalRow.title && goalRow.target_amount > 0
    ? {
      title: goalRow.title,
      target_amount: goalRow.target_amount,
      target_date: goalRow.target_date,
      currency: goalRow.currency,
      current_amount: goalRow.current_amount ?? 0,
    }
    : null;
  const limitRows = await db.getAllAsync<{
    category_id: number; month: string; limit_amount: number;
  }>(
    `SELECT category_id, month, limit_amount FROM category_limits
      WHERE month BETWEEN ? AND ? AND limit_amount > 0
      ORDER BY month ASC, id ASC`,
    [range.start.slice(0, 7), range.end.slice(0, 7)],
  );
  for (const limit of limitRows) categoryIds.add(limit.category_id);
  const cycleDayRow = await db.getFirstAsync<{ value: string }>(
    "SELECT value FROM settings WHERE key = 'budget_cycle_start_day'",
  );
  const cycleDayValue = cycleDayRow?.value != null ? Number(cycleDayRow.value) : null;
  const budgetCycleStartDayOut = cycleDayValue != null
    && Number.isInteger(cycleDayValue) && cycleDayValue >= 1 && cycleDayValue <= 31
    ? cycleDayValue : null;

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
  const categoryLimitsOut: ExportedCategoryLimit[] = [];
  for (const limit of limitRows) {
    const category = catById.get(limit.category_id);
    if (!category) continue;
    const parent = category.parent_id != null ? catById.get(category.parent_id) ?? null : null;
    categoryLimitsOut.push({
      category_name: category.name,
      category_parent_name: parent?.name ?? null,
      month: limit.month,
      limit_amount: limit.limit_amount,
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
      canonical_products: canonicalProductsOut,
      product_aliases: productAliasesOut,
      budget_rollovers: rolloversOut,
      container_deposit_vouchers: depositVouchersOut,
      container_deposit_recoveries: depositRecoveriesOut,
      savings_goal: savingsGoalOut,
      category_limits: categoryLimitsOut,
      budget_cycle_start_day: budgetCycleStartDayOut,
    },
  };
}

/**
 * BUG-31: "Tüm veriler" ön ayarı. Başlangıç = en eski kaydın tarihi (harcama,
 * borç, ödeme, ek gelir, bütçe dönemi, kupon, limit döngüsü); bitiş = bugün ya da
 * daha ileri tarihli son kayıt (fiş tarihi en çok 2 gün ileri olabilir). Hiç kayıt
 * yoksa bugün–bugün.
 */
export async function getAllDataRange(today: string = getToday()): Promise<BackupDateRange> {
  const db = await getDatabase();
  const row = await db.getFirstAsync<{ start: string | null; end: string | null }>(
    `SELECT MIN(first_day) AS start, MAX(last_day) AS end FROM (
       SELECT MIN(date) AS first_day, MAX(date) AS last_day FROM expenses
       UNION ALL SELECT MIN(date), MAX(date) FROM debts
       UNION ALL SELECT MIN(date), MAX(date) FROM debt_payments
       UNION ALL SELECT MIN(date), MAX(date) FROM extra_incomes
       UNION ALL SELECT MIN(period_start), NULL FROM budgets WHERE active = 1
       UNION ALL SELECT MIN(issued_date), MAX(issued_date) FROM container_deposit_vouchers
       UNION ALL SELECT MIN(month) || '-01', NULL FROM category_limits
     )`,
  );
  const start = sanitizeDate(row?.start ?? '') ?? today;
  const lastRecord = sanitizeDate(row?.end ?? '');
  const end = lastRecord && lastRecord > today ? lastRecord : today;
  return { start: start < end ? start : end, end };
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
 * Başarılı SAF kaydı veya iptal/hata sonrası cache kopyası temizlenir.
 * Paylaşılan kopya alıcı için tutulur; 24 saatten sonra açılış/export temizliğine girer.
 * ExportResult.fileUri geçici bir adrestir; kalıcı dosya garantisi vermez.
 */
export async function exportBackupToFile(
  range: BackupDateRange,
  options: {
    dialogTitle?: string;
    /** SEC-01: verilirse dosya bu parolayla şifrelenir (ADR-018). Saklanmaz. */
    password?: string;
  } = {},
): Promise<ExportResult> {
  await purgeBackupCopies();
  const payload = await buildBackupPayload(range);
  // Girintisiz: tipik fiş verisinde ~%37 daha küçük dosya (ölçüm: kalem başına
  // ~580 → ~370 bayt) ve daha düşük tepe bellek;
  // 25 MB içe aktarım sınırına daha geç ulaşılır (PERF-02, BUG-19).
  const plainJson = JSON.stringify(payload);
  // Dosya oluşturulmadan ve paylaşılmadan önce: geri yüklenemeyecek yedek üretme.
  assertBackupJsonRestorable(plainJson);
  const encrypted = options.password != null;
  const json = encrypted ? await encryptBackupJson(plainJson, options.password!) : plainJson;
  // Şifreli zarf base64 olduğu için ~%33 büyür; okuma sınırına sığmalı.
  if (encrypted && utf8ByteLength(json) > MAX_BACKUP_FILE_BYTES) {
    throw new Error(BACKUP_EXPORT_TOO_LARGE);
  }

  const fileName = encrypted
    ? `spark-backup_${payload.range.start}_${payload.range.end}_encrypted.json`
    : `spark-backup_${payload.range.start}_${payload.range.end}.json`;
  const fileNameNoExt = fileName.replace(/\.json$/i, '');

  const file = new File(Paths.cache, fileNameNoExt + '_' + Date.now() + '-' + Math.random().toString(36).slice(2) + '.json');
  if (file.exists) {
    try {
      file.delete();
    } catch {
      /* aynı dosya üzerine yazacağız */
    }
  }
  retainActiveExport(file.uri);
  let shared = false;
  try {
    file.create({ overwrite: true });
    file.write(json);

    const itemCount = payload.data.expenses.reduce((n, e) => n + e.items.length, 0);
    const debtCount = payload.data.debts?.length ?? 0;
    const debtPaymentCount = payload.data.debt_payments?.length ?? 0;
    const incomeCount = payload.data.extra_incomes?.length ?? 0;
    const reminderCount = payload.data.recurring_payment_reminders?.length ?? 0;
    const canonicalProductCount = payload.data.canonical_products?.length ?? 0;
    const productAliasCount = payload.data.product_aliases?.length ?? 0;
    const depositVoucherCount = payload.data.container_deposit_vouchers?.length ?? 0;
    const depositRecoveryCount = payload.data.container_deposit_recoveries?.length ?? 0;

    const result: ExportResult = {
      fileUri: file.uri,
      fileName,
      expenseCount: payload.data.expenses.length,
      itemCount,
      debtCount,
      debtPaymentCount,
      incomeCount,
      reminderCount,
      canonicalProductCount,
      productAliasCount,
      recordCount: payload.data.expenses.length + debtCount + debtPaymentCount
        + incomeCount + reminderCount + canonicalProductCount + productAliasCount
        + (payload.data.budget_rollovers?.length ?? 0) + depositVoucherCount + depositRecoveryCount,
      sizeBytes: file.size ?? json.length,
      destination: 'cancelled',
      encrypted,
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
        logError('SAF save failed, falling back to share', e);
      }
    }

    if (await Sharing.isAvailableAsync()) {
      // Once handoff starts, even a late error cannot prove that no recipient is reading.
      shared = true;
      await Sharing.shareAsync(file.uri, {
        mimeType: 'application/json',
        // Servis i18n'e erişmez; çevrilmiş başlığı çağıran ekran verir (BUG-30).
        dialogTitle: options.dialogTitle ?? 'S.P.A.R.K. backup',
        UTI: 'public.json',
      });
      result.destination = 'shared';
    }

    return result;
  } finally {
    releaseActiveExport(file.uri);
    if (!shared) {
      try { if (file.exists) file.delete(); } catch { /* next startup sweep */ }
    }
  }
}

export type ParsedBackup =
  | { encrypted: false; payload: BackupPayload; fileName: string }
  /** SEC-01: parolayla açılması gereken zarf; henüz doğrulanmadı. */
  | { encrypted: true; envelope: unknown; fileName: string };

/** DocumentPicker ile JSON seçtirir; okur, parse eder ve şema doğrulaması yapar. */
export async function pickAndParseBackupFile(): Promise<ParsedBackup | null> {
  const res = await DocumentPicker.getDocumentAsync({
    type: ['application/json', 'application/*', '*/*'],
    copyToCacheDirectory: false,
    multiple: false,
  });
  if (res.canceled || !res.assets?.[0]) return null;
  const asset = res.assets[0];
  if (typeof asset.size === 'number' && asset.size > MAX_BACKUP_FILE_BYTES) {
    throw new Error('INVALID_FORMAT');
  }
  const raw = await readBoundedBackup(asset.uri);
  const fileName = asset.name ?? 'backup.json';
  const parsed = parseBackupJson(raw);
  // SEC-01: şifreli zarf; payload parolayla açılınca doğrulanır.
  if (isEncryptedBackupEnvelope(parsed)) return { encrypted: true, envelope: parsed, fileName };
  return { encrypted: false, payload: validateAndNormalizeBackupPayload(parsed), fileName };
}

function parseBackupJson(raw: string): unknown {
  let parsed: unknown;
  try {
    parsed = JSON.parse(raw);
  } catch {
    throw new Error('INVALID_JSON');
  }
  if (parsed && typeof parsed === 'object') {
    stripDangerousKeys(parsed as Record<string, unknown>);
  }
  return parsed;
}

/**
 * SEC-01: şifreli yedeği parolayla açar ve doğrulanmış payload döndürür.
 * Yanlış parola `BACKUP_WRONG_PASSWORD`; açılan içerik düz yedekle aynı
 * doğrulamadan geçer.
 */
export async function openEncryptedBackup(envelope: unknown, password: string): Promise<BackupPayload> {
  const plain = await decryptBackupEnvelope(envelope, password);
  return validateAndNormalizeBackupPayload(parseBackupJson(plain));
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
    canonicalProductsAdded: 0,
    canonicalProductsSkipped: 0,
    productAliasesAdded: 0,
    productAliasesSkipped: 0,
    itemCanonicalLinksAdded: 0,
    rolloversAdded: 0,
    rolloversSkipped: 0,
    depositVouchersAdded: 0,
    depositVouchersSkipped: 0,
    depositRecoveriesAdded: 0,
    depositRecoveriesSkipped: 0,
    keptLocal: 0,
    savingsGoalAdded: 0,
    categoryLimitsAdded: 0,
    categoryLimitsSkipped: 0,
    cycleDayRestored: 0,
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
        const icon = safeCategoryIcon(sanitizeText(c.icon, 100));
        const color = safeCategoryColor(sanitizeText(c.color, 20));
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
        const icon = safeCategoryIcon(sanitizeText(c.icon, 100));
        const color = safeCategoryColor(sanitizeText(c.color, 20));
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

    // BUG-21 (v7): aynı adlı alt kategoriler (ör. iki ayrı "Diğer") üst adıyla
    // ayrılır. v6 ve öncesinde veya üst adla bulunamazsa eski ad eşlemesi geçerli.
    const categoryIdByPath = new Map<string, number>();
    const refreshedById = new Map(refreshed.map(c => [c.id, c] as const));
    for (const c of refreshed) {
      const parent = c.parent_id != null ? refreshedById.get(c.parent_id) : undefined;
      const path = `${(c.name || '').trim().toLowerCase()}::${(parent?.name ?? '').trim().toLowerCase()}`;
      if (!categoryIdByPath.has(path)) categoryIdByPath.set(path, c.id);
    }
    const resolveCategoryId = (
      name: string | null | undefined,
      parentName: string | null | undefined,
    ): number | null => {
      if (!name) return null;
      const lowered = name.trim().toLowerCase();
      if (payload.version >= 7 && parentName !== undefined) {
        const byPath = categoryIdByPath.get(`${lowered}::${(parentName ?? '').trim().toLowerCase()}`);
        if (byPath != null) return byPath;
      }
      return nameToId.get(lowered) ?? null;
    };

    // Vendors — default_category_name v2+ için
    const vendorIdByName = new Map<string, number>();
    const existingVendors = await db.getAllAsync<Vendor>(
      'SELECT id, name, logo_uri, default_category_id, created_at FROM vendors'
    );
    for (const v of existingVendors) {
      // BUG-14: canlı yolla aynı anahtar ("ŞOK" = "Şok").
      vendorIdByName.set(nameIdentityKey(v.name), v.id);
    }
    for (const v of payload.data.vendors || []) {
      const name = sanitizeText(v.name, 200);
      if (!name) continue;
      const key = nameIdentityKey(name);
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
        // Logo yolu bu cihaza ait bir dosyaya işaret etmez; yedekten asla yazılmaz (ADR-011, BUG-27).
        'INSERT INTO vendors (name, name_key, logo_uri, default_category_id) VALUES (?, ?, NULL, ?)',
        [name, key, defaultCatId]
      );
      vendorIdByName.set(key, Number(r.lastInsertRowId));
      summary.vendorsAdded += 1;
    }

    // v4 kanonik ürünleri yerel PK'lerden bağımsız, taşınabilir UID üzerinden
    // eşleştirir. Aynı canonical_key kasıtlı split sonrasında birden fazla fiziksel
    // ürünü temsil edebileceği için farklı UID'ler isim benzerliğiyle birleştirilmez.
    const existingCanonicalProducts = await db.getAllAsync<CanonicalProduct>(
      `SELECT id, uid, canonical_name, canonical_key, measurement_unit, brand,
              variant, package_descriptor, created_at, updated_at
         FROM canonical_products
        ORDER BY id ASC`,
    );
    const canonicalProductIdByStoredUid = new Map<string, number>();
    for (const existing of existingCanonicalProducts) {
      canonicalProductIdByStoredUid.set(existing.uid, existing.id);
    }

    const canonicalProductIdByPayloadUid = new Map<string, number>();
    const exactProductMetadata = (
      existing: CanonicalProduct,
      incoming: ExportedCanonicalProduct,
    ): boolean => existing.canonical_name === incoming.canonical_name
      && existing.canonical_key === incoming.canonical_key
      && existing.measurement_unit === incoming.measurement_unit
      && (existing.brand ?? null) === (incoming.brand ?? null)
      && (existing.variant ?? null) === (incoming.variant ?? null)
      && (existing.package_descriptor ?? null) === (incoming.package_descriptor ?? null)
      && existing.created_at === incoming.created_at
      && existing.updated_at === incoming.updated_at;

    for (const product of payload.data.canonical_products) {
      const uid = normalizeCanonicalUuid(product.uid);
      if (!uid) invalidFormat();
      const canonicalName = sanitizeText(product.canonical_name, 500);
      const canonicalKey = sanitizeText(product.canonical_key, 500);
      const brand = product.brand == null ? null : sanitizeText(product.brand, 200);
      const variant = product.variant == null ? null : sanitizeText(product.variant, 200);
      const packageDescriptor = product.package_descriptor == null
        ? null
        : sanitizeText(product.package_descriptor, 200);
      const normalizedProduct: ExportedCanonicalProduct = {
        ...product,
        uid,
        canonical_name: canonicalName,
        canonical_key: canonicalKey,
        brand,
        variant,
        package_descriptor: packageDescriptor,
      };

      const byUidId = canonicalProductIdByStoredUid.get(uid);
      if (byUidId != null) {
        const existing = existingCanonicalProducts.find(row => row.id === byUidId);
        if (!existing) invalidFormat();
        // BUG-20: ürün yeniden adlandırılmış/birleştirilmiş olabilir; cihaz kazanır.
        if (!exactProductMetadata(existing, normalizedProduct)) summary.keptLocal += 1;
        canonicalProductIdByPayloadUid.set(uid, existing.id);
        summary.canonicalProductsSkipped += 1;
        continue;
      }

      const inserted = await db.runAsync(
        `INSERT INTO canonical_products
           (uid, canonical_name, canonical_key, measurement_unit, brand, variant,
            package_descriptor, created_at, updated_at)
         VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?)`,
        [
          uid,
          canonicalName,
          canonicalKey,
          product.measurement_unit,
          brand,
          variant,
          packageDescriptor,
          product.created_at,
          product.updated_at,
        ],
      );
      const id = Number(inserted.lastInsertRowId);
      const insertedProduct: CanonicalProduct = {
        id,
        ...normalizedProduct,
      };
      existingCanonicalProducts.push(insertedProduct);
      canonicalProductIdByStoredUid.set(uid, id);
      canonicalProductIdByPayloadUid.set(uid, id);
      summary.canonicalProductsAdded += 1;
    }

    const existingProductAliases = await db.getAllAsync<ProductAlias>(
      `SELECT id, canonical_product_id, normalized_alias, measurement_unit,
              source, confidence, created_at
         FROM product_aliases
        ORDER BY id ASC`,
    );
    const aliasByKey = new Map<string, ProductAlias>();
    for (const alias of existingProductAliases) {
      aliasByKey.set(`${alias.measurement_unit}::${alias.normalized_alias}`, alias);
    }
    for (const alias of payload.data.product_aliases) {
      const uid = normalizeCanonicalUuid(alias.canonical_product_uid);
      const canonicalProductId = uid ? canonicalProductIdByPayloadUid.get(uid) : null;
      if (!uid || canonicalProductId == null) invalidFormat();
      const normalizedAlias = sanitizeText(alias.normalized_alias, 500);
      const key = `${alias.measurement_unit}::${normalizedAlias}`;
      const existing = aliasByKey.get(key);
      if (existing) {
        // BUG-20: eşleştirme cihazda değiştirilmişse kullanıcının son kararı kalır.
        if (existing.canonical_product_id !== canonicalProductId) summary.keptLocal += 1;
        summary.productAliasesSkipped += 1;
        continue;
      }
      const inserted = await db.runAsync(
        `INSERT INTO product_aliases
           (canonical_product_id, normalized_alias, measurement_unit, source,
            confidence, created_at)
         VALUES (?, ?, ?, ?, ?, ?)`,
        [
          canonicalProductId,
          normalizedAlias,
          alias.measurement_unit,
          alias.source,
          alias.confidence ?? null,
          alias.created_at,
        ],
      );
      aliasByKey.set(key, {
        id: Number(inserted.lastInsertRowId),
        canonical_product_id: canonicalProductId,
        normalized_alias: normalizedAlias,
        measurement_unit: alias.measurement_unit,
        source: alias.source,
        confidence: alias.confidence ?? null,
        created_at: alias.created_at,
      });
      summary.productAliasesAdded += 1;
    }

    // Expenses + items. Aday havuzu transaction başlamadan önce var olan
    // satırlardan kurulur ve her aday en fazla bir kaynak kaydı için tüketilir.
    // Böylece aynı gün/satıcı/tutar/not değerlerine sahip iki meşru işlem ilk
    // importta birbirini yutmaz; aynı v3/v4 dosyası tekrar geldiğinde de kararlı
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
      container_deposit_paid: number;
      container_voucher_used: number;
      uid?: string | null;
    }>(
      `SELECT id, uid, vendor_id, category_id, total_amount, currency, note, date, created_at,
              container_deposit_paid, container_voucher_used
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
        containerDepositPaid?: number;
        containerVoucherUsed?: number;
      },
    ): string => version >= 6
      // BUG-01 6b: para birimi yalnız etikettir; kullanıcı yedekten sonra para
      // birimini değiştirdiyse aynı harcama yine tanınmalı. Anahtara girmez.
      ? JSON.stringify([
          value.createdAt, value.date, toMinorUnits(value.total),
          value.vendorId, value.categoryId, value.note ?? '',
          toMinorUnits(value.containerDepositPaid ?? 0),
          toMinorUnits(value.containerVoucherUsed ?? 0),
        ])
      : version >= 3
      ? JSON.stringify([
          value.createdAt,
          value.date,
          toMinorUnits(value.total),
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
    // BUG-21: v7 dosyasında harcama önce kalıcı kimliğiyle tanınır; yedekten sonra
    // tutarı/notu/kategorisi değişen harcama böylece ikinci kez eklenmez.
    const existingExpenseIdByUid = new Map<string, number>();
    const existingExpenseKeyById = new Map<number, string>();
    const consumedExpenseIds = new Set<number>();
    for (const existing of existingExpenses) {
      if (existing.uid) existingExpenseIdByUid.set(existing.uid, existing.id);
      const key = expenseKey(payload.version, {
        vendorId: existing.vendor_id,
        categoryId: existing.category_id,
        total: existing.total_amount,
        currency: existing.currency,
        note: existing.note,
        date: existing.date,
        createdAt: existing.created_at,
        containerDepositPaid: existing.container_deposit_paid,
        containerVoucherUsed: existing.container_voucher_used,
      });
      existingExpenseKeyById.set(existing.id, key);
      const pool = existingExpensePools.get(key) ?? [];
      pool.push(existing.id);
      existingExpensePools.set(key, pool);
    }

    type ExistingImportItem = {
      id: number;
      name: string;
      turkish_name: string | null;
      user_label: string | null;
      quantity: number;
      measurement_unit: 'piece' | 'kg' | 'l';
      canonical_product_id: number | null;
      unit_price: number;
      total_price: number;
      category_id: number | null;
      line_discount: number | null;
      list_line_total_before_discount: number | null;
      financial_kind: 'product' | 'container_deposit';
    };
    const itemFingerprint = (value: {
      name: string;
      turkishName: string | null;
      quantity: number;
      measurementUnit: 'piece' | 'kg' | 'l';
      unitPrice: number;
      totalPrice: number;
      categoryId: number | null;
      lineDiscount: number | null;
      listBefore: number | null;
      financialKind?: 'product' | 'container_deposit';
    }): string => JSON.stringify([
      value.name,
      value.turkishName,
      value.quantity,
      value.measurementUnit,
      value.unitPrice,
      value.totalPrice,
      value.categoryId,
      value.lineDiscount == null ? null : toMinorUnits(value.lineDiscount),
      value.listBefore == null ? null : toMinorUnits(value.listBefore),
      value.financialKind ?? 'product',
    ]);
    /**
     * Imported expense header → content fields + duplicate key. Ön tarama ile asıl
     * döngü AYNI fonksiyonu kullanır; böylece önceden okunan kalem kümesi döngünün
     * eşleştireceği harcamaları kesin kapsar.
     */
    const prepareImportedExpense = (exp: ExportedExpense) => {
      const date = sanitizeDate(exp.date);
      if (!date) return null;
      const total = sanitizeAmount(exp.total_amount);
      const currency = sanitizeText(exp.currency || 'PLN', 10);
      const note = exp.note ? sanitizeText(exp.note, 1000) : null;
      const receiptUri = exp.receipt_uri && typeof exp.receipt_uri === 'string'
        ? sanitizeText(exp.receipt_uri, 2000) : null;
      const containerDepositPaid = payload.version >= 6
        ? sanitizeAmount(exp.container_deposit_paid ?? 0) : 0;
      const containerVoucherUsed = payload.version >= 6
        ? sanitizeAmount(exp.container_voucher_used ?? 0) : 0;
      const vendorId = exp.vendor_name
        ? vendorIdByName.get(nameIdentityKey(exp.vendor_name)) ?? null
        : null;
      const categoryId = resolveCategoryId(exp.category_name, exp.category_parent_name);
      const key = expenseKey(payload.version, {
        vendorId,
        categoryId,
        total,
        currency,
        note,
        date,
        createdAt: exp.created_at ?? null,
        containerDepositPaid,
        containerVoucherUsed,
      });
      return {
        date, total, currency, note, receiptUri,
        containerDepositPaid, containerVoucherUsed, vendorId, categoryId, key,
      };
    };

    // PERF-09: yinelenen harcamaların mevcut kalemleri, harcama başına ayrı sorgu
    // yerine tek seferde (400'lük parçalarla) okunur. Yalnız dosyadaki bir
    // harcamayla anahtar olarak eşleşebilecek mevcut harcamalar okunur; büyük
    // veritabanına küçük yedek yüklerken tüm kalem tablosu çekilmez.
    // Bu anlık görüntü güvenlidir: içe aktarım mevcut bir harcamanın kalemlerini
    // yalnız o harcamanın kendi karşılaştırmasında günceller ve her mevcut
    // harcama havuzdan en fazla bir kez alınır.
    const existingItemsByExpense = new Map<number, ExistingImportItem[]>();
    if (payload.version >= 4) {
      const candidateIds = new Set<number>();
      for (const exp of payload.data.expenses || []) {
        const prepared = prepareImportedExpense(exp);
        for (const id of prepared ? existingExpensePools.get(prepared.key) ?? [] : []) {
          candidateIds.add(id);
        }
        const byUid = payload.version >= 7 && exp.uid ? existingExpenseIdByUid.get(exp.uid) : undefined;
        if (byUid != null) candidateIds.add(byUid);
      }
      const ids = [...candidateIds].sort((a, b) => a - b);
      for (let i = 0; i < ids.length; i += 400) {
        const chunk = ids.slice(i, i + 400);
        const rows = await db.getAllAsync<ExistingImportItem & { expense_id: number }>(
          `SELECT id, expense_id, name, turkish_name, user_label, quantity, measurement_unit,
                  canonical_product_id, unit_price, total_price, category_id,
                  line_discount, list_line_total_before_discount
                  , financial_kind
             FROM expense_items
            WHERE expense_id IN (${chunk.map(() => '?').join(', ')})
            ORDER BY expense_id ASC, id ASC`,
          chunk,
        );
        for (const row of rows) {
          const bucket = existingItemsByExpense.get(row.expense_id);
          if (bucket) bucket.push(row);
          else existingItemsByExpense.set(row.expense_id, [row]);
        }
      }
    }

    const reconcileDuplicateExpenseItems = async (
      targetExpenseId: number,
      importedItems: ExportedExpenseItem[],
    ): Promise<void> => {
      const existingItems = existingItemsByExpense.get(targetExpenseId) ?? [];
      const pools = new Map<string, ExistingImportItem[]>();
      for (const existing of existingItems) {
        const key = itemFingerprint({
          name: existing.name,
          turkishName: existing.turkish_name ?? null,
          quantity: sanitizeQuantity(existing.quantity),
          measurementUnit: sanitizeMeasurementUnit(existing.measurement_unit),
          unitPrice: sanitizeUnitPrice(existing.unit_price),
          totalPrice: roundMoney(sanitizeUnitPrice(existing.total_price)),
          categoryId: existing.category_id ?? null,
          lineDiscount: existing.line_discount == null
            ? 0
            : sanitizeAmount(existing.line_discount),
          listBefore: existing.list_line_total_before_discount == null
            ? null
            : sanitizeAmount(existing.list_line_total_before_discount),
          financialKind: existing.financial_kind,
        });
        const candidates = pools.get(key) ?? [];
        candidates.push(existing);
        pools.set(key, candidates);
      }

      for (const item of importedItems) {
        const itemName = sanitizeText(item.name, 500) || 'Ürün';
        const itemTurkish = item.turkish_name ? sanitizeText(item.turkish_name, 500) : null;
        const itemCategoryId = resolveCategoryId(item.category_name, item.category_parent_name);
        const quantity = sanitizeQuantity(item.quantity);
        const measurementUnit = sanitizeMeasurementUnit(item.measurement_unit);
        const unitPrice = sanitizeUnitPrice(item.unit_price);
        const totalPrice = roundMoney(sanitizeUnitPrice(item.total_price));
        const lineDiscount = item.line_discount != null ? sanitizeAmount(item.line_discount) : 0;
        const listBefore = item.list_line_total_before_discount != null
          ? sanitizeAmount(item.list_line_total_before_discount)
          : null;
        const key = itemFingerprint({
          name: itemName,
          turkishName: itemTurkish,
          quantity,
          measurementUnit,
          unitPrice,
          totalPrice,
          categoryId: itemCategoryId,
          lineDiscount,
          listBefore,
          financialKind: item.financial_kind === 'container_deposit' ? 'container_deposit' : 'product',
        });
        const existing = pools.get(key)?.shift();
        if (!existing) {
          // BUG-20: harcama cihazda zaten var ve kalemi yedekten sonra düzenlenmiş
          // (ad, fiyat, kategori...). Cihazdaki kalem listesi geçerlidir.
          summary.keptLocal += 1;
          continue;
        }

        const canonicalUid = item.canonical_product_uid == null
          ? null
          : normalizeCanonicalUuid(item.canonical_product_uid);
        const canonicalProductId = canonicalUid == null
          ? null
          : canonicalProductIdByPayloadUid.get(canonicalUid) ?? null;
        if (canonicalUid != null && canonicalProductId == null) invalidFormat();
        const rawUserLabel = item.user_label == null ? null : sanitizeText(item.user_label, 500);
        const userLabel = rawUserLabel || null;
        // BUG-20: cihazda farklı ürüne bağlanmış veya etiketi değişmiş kalemde
        // cihazdaki karar korunur; yalnız boş alanlar yedekten doldurulur.
        if ((canonicalProductId != null
          && existing.canonical_product_id != null
          && existing.canonical_product_id !== canonicalProductId)
          || (userLabel != null && existing.user_label != null && existing.user_label !== userLabel)) {
          summary.keptLocal += 1;
        }

        const fields: string[] = [];
        const values: Array<string | number | null> = [];
        if (canonicalProductId != null && existing.canonical_product_id == null) {
          fields.push('canonical_product_id = ?');
          values.push(canonicalProductId);
          summary.itemCanonicalLinksAdded += 1;
        }
        if (userLabel != null && existing.user_label == null) {
          fields.push('user_label = ?');
          values.push(userLabel);
        }
        if (fields.length > 0) {
          values.push(existing.id);
          await db.runAsync(
            `UPDATE expense_items SET ${fields.join(', ')} WHERE id = ?`,
            values,
          );
        }
      }
    };

    const expenseIdBySource = new Map<number, number>();
    /** Bu içe aktarımda eklenen harcamalar; diğerleri cihazda zaten vardı. */
    const addedExpenseIds = new Set<number>();
    for (const exp of payload.data.expenses || []) {
      const prepared = prepareImportedExpense(exp);
      if (!prepared) { summary.expensesSkipped += 1; continue; }
      const {
        date, total, currency, note, receiptUri,
        containerDepositPaid, containerVoucherUsed, vendorId, categoryId, key,
      } = prepared;
      let duplicateId: number | null = null;
      const byUid = payload.version >= 7 && exp.uid ? existingExpenseIdByUid.get(exp.uid) : undefined;
      if (byUid != null && !consumedExpenseIds.has(byUid)) {
        duplicateId = byUid;
        consumedExpenseIds.add(byUid);
        // Aynı harcama cihazda yedekten sonra düzenlenmiş: cihaz kazanır (BUG-20).
        if (existingExpenseKeyById.get(byUid) !== key) summary.keptLocal += 1;
      } else {
        duplicateId = takePoolCandidate(existingExpensePools, key, consumedExpenseIds);
      }
      if (duplicateId != null) {
        if (exp.source_id != null) expenseIdBySource.set(exp.source_id, duplicateId);
        if (payload.version >= 4) {
          await reconcileDuplicateExpenseItems(duplicateId, exp.items || []);
        }
        summary.expensesSkipped += 1;
        continue;
      }

      const ins = payload.version >= 7
        ? await db.runAsync(
            `INSERT INTO expenses
               (uid, vendor_id, category_id, total_amount, currency, note, receipt_uri, date, created_at,
                container_deposit_paid, container_voucher_used)
             VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`,
            [exp.uid!, vendorId, categoryId, total, currency, note, receiptUri, date, exp.created_at!,
              containerDepositPaid, containerVoucherUsed],
          )
        : payload.version >= 6
        ? await db.runAsync(
            `INSERT INTO expenses
               (vendor_id, category_id, total_amount, currency, note, receipt_uri, date, created_at,
                container_deposit_paid, container_voucher_used)
             VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`,
            [vendorId, categoryId, total, currency, note, receiptUri, date, exp.created_at!,
              containerDepositPaid, containerVoucherUsed],
          )
        : payload.version >= 3
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
      addedExpenseIds.add(expenseId);
      summary.expensesAdded += 1;

      for (const it of exp.items || []) {
        const itemName = sanitizeText(it.name, 500) || 'Ürün';
        const itemTurkish = it.turkish_name ? sanitizeText(it.turkish_name, 500) : null;
        const rawUserLabel = payload.version >= 4 && it.user_label != null
          ? sanitizeText(it.user_label, 500)
          : null;
        const userLabel = rawUserLabel || null;
        const qty = sanitizeQuantity(it.quantity);
        const unit = sanitizeUnitPrice(it.unit_price);
        const tp = roundMoney(sanitizeUnitPrice(it.total_price));
        const ld = it.line_discount != null ? sanitizeAmount(it.line_discount) : 0;
        const lb = it.list_line_total_before_discount != null
          ? sanitizeAmount(it.list_line_total_before_discount) : null;
        const itemCatId = resolveCategoryId(it.category_name, it.category_parent_name);
        const canonicalUid = payload.version < 4 || it.canonical_product_uid == null
          ? null
          : normalizeCanonicalUuid(it.canonical_product_uid);
        const canonicalProductId = canonicalUid == null
          ? null
          : canonicalProductIdByPayloadUid.get(canonicalUid) ?? null;
        if (canonicalUid != null && canonicalProductId == null) invalidFormat();
        await db.runAsync(
          `INSERT INTO expense_items
             (expense_id, name, turkish_name, user_label, quantity,
              measurement_unit, canonical_product_id, unit_price, total_price,
              category_id, line_discount, list_line_total_before_discount, financial_kind)
           VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`,
          [
            expenseId,
            itemName,
            itemTurkish,
            userLabel,
            qty,
            sanitizeMeasurementUnit(it.measurement_unit),
            canonicalProductId,
            unit,
            tp,
            itemCatId,
            ld,
            lb,
            payload.version >= 6 && it.financial_kind === 'container_deposit'
              ? 'container_deposit'
              : 'product',
          ]
        );
        summary.itemsAdded += 1;
        if (canonicalProductId != null) summary.itemCanonicalLinksAdded += 1;
      }
    }

    if (payload.version >= 6) {
      const voucherIdByUid = new Map<string, number>();
      const existingVouchers = await db.getAllAsync<ContainerDepositVoucher>(
        'SELECT * FROM container_deposit_vouchers ORDER BY id ASC',
      );
      const existingVoucherByUid = new Map(existingVouchers.map(v => [v.uid, v]));
      for (const voucher of existingVouchers) voucherIdByUid.set(voucher.uid, voucher.id);
      for (const voucher of payload.data.container_deposit_vouchers) {
      const uid = normalizeCanonicalUuid(voucher.uid)!;
      const linkedExpenseId = voucher.redemption_expense_source_id == null
        ? null
        : expenseIdBySource.get(voucher.redemption_expense_source_id) ?? null;
      const existingId = voucherIdByUid.get(uid);
      if (existingId != null) {
        const existing = existingVoucherByUid.get(uid)!;
        // BUG-20: süresi dolan, kullanılan veya silinip geri gelen kuponda cihaz
        // kazanır. Para birimi etikettir (BUG-01 6b) ve karşılaştırılmaz.
        if (toMinorUnits(existing.amount) !== toMinorUnits(voucher.amount)
          || existing.issued_date !== voucher.issued_date
          || existing.expires_on !== voucher.expires_on
          || existing.status !== voucher.status
          || existing.redeemed_date !== voucher.redeemed_date
          || existing.note !== voucher.note
          || existing.created_at !== voucher.created_at
          // A null link can mean the export deliberately omitted an out-of-range expense.
          || (linkedExpenseId != null && existing.redemption_expense_id !== linkedExpenseId)) {
          summary.keptLocal += 1;
        }
        summary.depositVouchersSkipped += 1;
        continue;
      }
      const inserted = await db.runAsync(
        `INSERT INTO container_deposit_vouchers
          (uid, amount, currency, issued_date, expires_on, status, redeemed_date,
           redemption_expense_id, note, created_at)
         VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`,
        [uid, sanitizeAmount(voucher.amount), voucher.currency, voucher.issued_date,
          voucher.expires_on, voucher.status, voucher.redeemed_date, linkedExpenseId,
          voucher.note, voucher.created_at],
      );
      voucherIdByUid.set(uid, Number(inserted.lastInsertRowId));
      summary.depositVouchersAdded += 1;
      }

      const existingRecoveries = new Map(
        (await db.getAllAsync<ContainerDepositRecovery>('SELECT * FROM container_deposit_recoveries'))
          .map(row => [row.uid, row] as const),
      );
      const usedVoucherIds = new Set(
        [...existingRecoveries.values()].map(recovery => recovery.voucher_id).filter(id => id != null),
      );
      for (const recovery of payload.data.container_deposit_recoveries) {
      const uid = normalizeCanonicalUuid(recovery.uid)!;
      const voucherId = recovery.voucher_uid == null
        ? null
        : voucherIdByUid.get(recovery.voucher_uid) ?? null;
      const expenseId = recovery.expense_source_id == null
        ? null
        : expenseIdBySource.get(recovery.expense_source_id) ?? null;
      const existing = existingRecoveries.get(uid);
      if (existing) {
        if (existing.voucher_id !== voucherId || existing.expense_id !== expenseId
          || toMinorUnits(existing.amount) !== toMinorUnits(recovery.amount)
          || existing.date !== recovery.date
          || existing.method !== recovery.method || existing.created_at !== recovery.created_at) {
          summary.keptLocal += 1;
        }
        summary.depositRecoveriesSkipped += 1;
        continue;
      }
      // BUG-20: harcama cihazda zaten vardıysa onun depozito kaydı cihazdakidir
      // (harcama her kaydedildiğinde kayıt yeni kimlikle yeniden yazılır); kupon
      // cihazda başka bir alışverişte kullanıldıysa iki kez sayılmaz.
      if ((expenseId != null && !addedExpenseIds.has(expenseId))
        || (voucherId != null && usedVoucherIds.has(voucherId))) {
        summary.keptLocal += 1;
        summary.depositRecoveriesSkipped += 1;
        continue;
      }
      await db.runAsync(
        `INSERT INTO container_deposit_recoveries
          (uid, voucher_id, expense_id, amount, currency, date, method, created_at)
         VALUES (?, ?, ?, ?, ?, ?, ?, ?)`,
        [uid, voucherId, expenseId, sanitizeAmount(recovery.amount), recovery.currency,
          recovery.date, recovery.method, recovery.created_at],
      );
      if (voucherId != null) usedVoucherIds.add(voucherId);
      summary.depositRecoveriesAdded += 1;
      }
    }

    // v2+: Dismissed abonelikler — aktif türetilmiş abonelikler tekrar
    // üretilebilir; kullanıcının reddi ise vendor eşlemesiyle korunur.
    const dismissed = payload.data.dismissed_subscriptions;
    if (dismissed.length > 0) {
      const nowIso = new Date().toISOString();
      for (const entry of dismissed) {
        const vendorName = nameIdentityKey(entry.vendor_name);
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
      uid?: string | null;
    }>(
      `SELECT id, uid, direction, counterparty, amount, remaining, currency, date,
              status, due_date,
              reminder_enabled, reminder_days_before, reminder_time,
              linked_expense_id, note, created_at
         FROM debts ORDER BY id ASC`,
    );
    const debtExactPools = new Map<string, number[]>();
    const debtWithoutLinkPools = new Map<string, number[]>();
    const consumedDebtIds = new Set<number>();
    // BUG-21: tamamen ödenen (hatırlatıcısı kapanan) veya vadesi değişen borç v7
    // kimliğiyle tanınır; eski yedek onu "açık" ikinci bir borç olarak eklemez.
    const existingDebtIdByUid = new Map<string, number>();
    const existingDebtKeyById = new Map<number, string>();
    for (const existing of existingDebts) {
      if (existing.uid) existingDebtIdByUid.set(existing.uid, existing.id);
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
      existingDebtKeyById.set(existing.id, debtKey(canonical, false));
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

      const debtByUid = payload.version >= 7 && debt.uid ? existingDebtIdByUid.get(debt.uid) : undefined;
      let targetDebtId: number | null = null;
      if (debtByUid != null && !consumedDebtIds.has(debtByUid)) {
        targetDebtId = debtByUid;
        consumedDebtIds.add(debtByUid);
        if (existingDebtKeyById.get(debtByUid) !== debtKey(canonical, false)) summary.keptLocal += 1;
      } else {
        targetDebtId = takePoolCandidate(
          relationIsExact ? debtExactPools : debtWithoutLinkPools,
          key,
          consumedDebtIds,
        );
      }
      if (targetDebtId != null) {
        summary.debtsSkipped += 1;
      } else {
        const inserted = await db.runAsync(
          `INSERT INTO debts
             (direction, counterparty, amount, remaining, currency, date, status,
              linked_expense_id, note, created_at, due_date, reminder_enabled,
              reminder_days_before, reminder_time, uid)
           VALUES (?, ?, ?, ?, ?, ?, 'open', ?, ?, ?, ?, ?, ?, ?, ?)`,
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
            payload.version >= 7 ? debt.uid! : null,
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
      uid?: string | null;
    }>(
      `SELECT id, uid, debt_id, amount, date, created_at
         FROM debt_payments ORDER BY id ASC`,
    );
    const paymentPools = new Map<string, number[]>();
    const consumedPaymentIds = new Set<number>();
    const existingPaymentIdByUid = new Map<string, number>();
    for (const existing of existingPayments) {
      if (existing.uid) existingPaymentIdByUid.set(existing.uid, existing.id);
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
      const paymentByUid = payload.version >= 7 && payment.uid
        ? existingPaymentIdByUid.get(payment.uid) : undefined;
      if (paymentByUid != null && !consumedPaymentIds.has(paymentByUid)) {
        consumedPaymentIds.add(paymentByUid);
        summary.debtPaymentsSkipped += 1;
        continue;
      }
      if (takePoolCandidate(paymentPools, key, consumedPaymentIds) != null) {
        summary.debtPaymentsSkipped += 1;
        continue;
      }
      const nextPaidMinor = (paidMinorByTarget.get(debtId) ?? 0) + toMinorUnits(amount);
      if (nextPaidMinor > (debtAmountMinorByTarget.get(debtId) ?? 0)) {
        // BUG-20: cihazdaki ödeme geçmişi yedekten sonra değişmiş (ödeme silinip
        // yenisi girilmiş); borcu anaparadan fazla ödenmiş göstermek yerine cihaz kazanır.
        summary.keptLocal += 1;
        summary.debtPaymentsSkipped += 1;
        continue;
      }
      if (payload.version >= 7) {
        await db.runAsync(
          'INSERT INTO debt_payments (uid, debt_id, amount, date, created_at) VALUES (?, ?, ?, ?, ?)',
          [payment.uid!, debtId, amount, payment.date, createdAt],
        );
      } else {
        await db.runAsync(
          'INSERT INTO debt_payments (debt_id, amount, date, created_at) VALUES (?, ?, ?, ?)',
          [debtId, amount, payment.date, createdAt],
        );
      }
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
      uid?: string | null;
    }>(
      `SELECT id, uid, source, amount, currency, date, note, created_at
         FROM extra_incomes ORDER BY id ASC`,
    );
    const incomePools = new Map<string, number[]>();
    const consumedIncomeIds = new Set<number>();
    const existingIncomeIdByUid = new Map<string, number>();
    const existingIncomeKeyById = new Map<number, string>();
    for (const existing of existingIncomes) {
      if (existing.uid) existingIncomeIdByUid.set(existing.uid, existing.id);
      existingIncomeKeyById.set(existing.id, incomeKey({
        createdAt: existing.created_at,
        source: existing.source,
        amount: existing.amount,
        currency: existing.currency,
        date: existing.date,
        note: existing.note,
      }));
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
      const incomeByUid = payload.version >= 7 && income.uid
        ? existingIncomeIdByUid.get(income.uid) : undefined;
      if (incomeByUid != null && !consumedIncomeIds.has(incomeByUid)) {
        consumedIncomeIds.add(incomeByUid);
        if (existingIncomeKeyById.get(incomeByUid) !== key) summary.keptLocal += 1;
        summary.extraIncomesSkipped += 1;
        continue;
      }
      if (takePoolCandidate(incomePools, key, consumedIncomeIds) != null) {
        summary.extraIncomesSkipped += 1;
        continue;
      }
      if (payload.version >= 7) {
        await db.runAsync(
          `INSERT INTO extra_incomes (uid, source, amount, currency, date, note, created_at)
           VALUES (?, ?, ?, ?, ?, ?, ?)`,
          [income.uid!, source, amount, currency, income.date, note, createdAt],
        );
      } else {
        await db.runAsync(
          `INSERT INTO extra_incomes (source, amount, currency, date, note, created_at)
           VALUES (?, ?, ?, ?, ?, ?)`,
          [source, amount, currency, income.date, note, createdAt],
        );
      }
      summary.extraIncomesAdded += 1;
    }

    // Recurring reminder — UID taşınabilir logical kimliktir. Yalnız birebir
    // eşleşme atlanır; aynı UID'nin farklı içeriği veya detected-vendor tekillik
    // çakışması sessiz veri kaybı yerine tüm importu reddeder.
    for (const reminder of payload.data.recurring_payment_reminders) {
      const uid = normalizeCanonicalUuid(reminder.uid);
      if (!uid) invalidFormat();
      const vendorId = reminder.vendor_name
        ? vendorIdByName.get(nameIdentityKey(reminder.vendor_name)) ?? null
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
        // BUG-20: vade ilerlemiş, duraklatılmış veya düzenlenmiş hatırlatıcıda
        // cihaz kazanır. Para birimi etikettir ve karşılaştırmaya girmez.
        if (!exact) summary.keptLocal += 1;
        summary.remindersSkipped += 1;
        continue;
      }
      if (reminder.source === 'detected' && vendorId != null) {
        const existingDetected = await db.getFirstAsync<{ id: number }>(
          `SELECT id FROM recurring_payment_reminders
            WHERE source = 'detected' AND vendor_id = ? LIMIT 1`,
          [vendorId],
        );
        if (existingDetected) {
          // Aynı satıcı için cihaz kendi tespitini zaten üretmiş; ikincisi eklenmez.
          summary.keptLocal += 1;
          summary.remindersSkipped += 1;
          continue;
        }
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
    // BUG-20: devir cihazdaki bütçe dönemleriyle birebir uyuşmuyorsa (dönem
    // cihazda farklı sınırlarla kurulmuş) veya aynı kaynak dönem için cihazda
    // zaten bir devir varsa cihaz kazanır: aynı kaynak asla iki kez aktarılmaz ve
    // kullanıcının devri ezilmez. Para birimi etikettir ve karşılaştırılmaz.
    for (const r of payload.data.budget_rollovers) {
      let periodsMatch = true;
      for (const [start, end] of [[r.source_start, r.source_end], [r.target_start, r.target_end]]) {
        const matches = await db.getAllAsync<{ period_start: string; period_end: string }>(
          'SELECT period_start, period_end FROM budgets WHERE active = 1 AND period_start <= ? AND period_end >= ?', [end, start]);
        if (matches.length !== 1 || matches[0].period_start !== start || matches[0].period_end !== end) periodsMatch = false;
      }
      const existing = await db.getFirstAsync<BudgetRollover>('SELECT * FROM budget_rollovers WHERE uid = ? OR (source_start = ? AND source_end = ?)',
        [r.uid, r.source_start, r.source_end]);
      if (existing || !periodsMatch) {
        if (!existing || existing.source_start !== r.source_start || existing.source_end !== r.source_end
          || existing.target_start !== r.target_start || existing.target_end !== r.target_end
          || existing.amount_minor !== r.amount_minor) summary.keptLocal += 1;
        summary.rolloversSkipped += 1;
        continue;
      }
      await db.runAsync(`INSERT INTO budget_rollovers (uid, source_start, source_end, target_start, target_end, currency, amount_minor, created_at, updated_at)
        VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?)`, [r.uid, r.source_start, r.source_end, r.target_start, r.target_end, r.currency, r.amount_minor, r.created_at, r.updated_at]);
      summary.rolloversAdded += 1;
    }

    // BUG-31 (v7): hedef, limitler ve döngü günü. Kural BUG-20 ile aynı: cihazda
    // varsa cihazdaki korunur, yoksa yedekteki yüklenir; hiçbir şey ezilmez.
    const backupGoal = payload.data.savings_goal;
    if (backupGoal) {
      const localGoal = await db.getFirstAsync<{
        title: string; target_amount: number; target_date: string; current_amount: number;
      }>('SELECT title, target_amount, target_date, current_amount FROM savings_goal WHERE id = 1');
      if (!localGoal) {
        await db.runAsync(
          `INSERT INTO savings_goal (id, title, target_amount, target_date, currency, current_amount)
           VALUES (1, ?, ?, ?, ?, ?)`,
          [
            sanitizeText(backupGoal.title, 200),
            roundMoney(sanitizeAmount(backupGoal.target_amount)),
            backupGoal.target_date,
            sanitizeText(backupGoal.currency, 10) || 'PLN',
            roundMoney(sanitizeAmount(backupGoal.current_amount)),
          ],
        );
        summary.savingsGoalAdded = 1;
      } else if (localGoal.title !== backupGoal.title
        || toMinorUnits(localGoal.target_amount) !== toMinorUnits(backupGoal.target_amount)
        || localGoal.target_date !== backupGoal.target_date
        || toMinorUnits(localGoal.current_amount ?? 0) !== toMinorUnits(backupGoal.current_amount)) {
        summary.keptLocal += 1;
      }
    }

    for (const limit of payload.data.category_limits) {
      const categoryId = resolveCategoryId(limit.category_name, limit.category_parent_name ?? null);
      if (categoryId == null) {
        summary.categoryLimitsSkipped += 1;
        continue;
      }
      const amount = roundMoney(sanitizeAmount(limit.limit_amount));
      const existing = await db.getFirstAsync<{ limit_amount: number }>(
        'SELECT limit_amount FROM category_limits WHERE category_id = ? AND month = ?',
        [categoryId, limit.month],
      );
      if (existing) {
        if (toMinorUnits(existing.limit_amount) !== toMinorUnits(amount)) summary.keptLocal += 1;
        summary.categoryLimitsSkipped += 1;
        continue;
      }
      await db.runAsync(
        'INSERT INTO category_limits (category_id, month, limit_amount) VALUES (?, ?, ?)',
        [categoryId, limit.month, amount],
      );
      summary.categoryLimitsAdded += 1;
    }

    if (payload.data.budget_cycle_start_day != null) {
      const localCycleDay = await db.getFirstAsync<{ value: string }>(
        "SELECT value FROM settings WHERE key = 'budget_cycle_start_day'",
      );
      if (!localCycleDay) {
        await db.runAsync(
          "INSERT INTO settings (key, value) VALUES ('budget_cycle_start_day', ?)",
          [String(payload.data.budget_cycle_start_day)],
        );
        summary.cycleDayRestored = 1;
      } else if (Number(localCycleDay.value) !== payload.data.budget_cycle_start_day) {
        summary.keptLocal += 1;
      }
    }

    // BUG-01 6b: uygulama tek para birimlidir; para birimi etikettir. Yedekten
    // gelen kayıtlar cihazın para birimi etiketini alır (tutarlar değişmez).
    // Ayar yoksa uygulamanın gösterdiği varsayılan (PLN) geçerlidir.
    await relabelCurrencyRowsToAppCurrency(db);
  });

  return summary;
}

/** Kolaylaştırıcı: dosyayı seç + parse et + import et. */
export async function pickAndImportBackup(
  /**
   * SEC-01: dosya şifreliyse parola istenir. `lastAttemptWrong` önceki parola
   * yanlışsa true'dur. null dönerse kullanıcı vazgeçmiştir; hiçbir şey yazılmaz.
   */
  requestPassword?: (lastAttemptWrong: boolean) => Promise<string | null>,
): Promise<{
  summary: ImportSummary;
  fileName: string;
} | null> {
  const parsed = await pickAndParseBackupFile();
  if (!parsed) return null;
  let payload: BackupPayload;
  if (parsed.encrypted) {
    if (!requestPassword) throw new Error(BACKUP_WRONG_PASSWORD);
    let lastAttemptWrong = false;
    for (;;) {
      const password = await requestPassword(lastAttemptWrong);
      if (password == null) return null;
      try {
        payload = await openEncryptedBackup(parsed.envelope, password);
        break;
      } catch (error) {
        if (!(error instanceof Error) || error.message !== BACKUP_WRONG_PASSWORD) throw error;
        lastAttemptWrong = true;
      }
    }
  } else {
    payload = parsed.payload;
  }
  const summary = await importBackupPayload(payload);
  return { summary, fileName: parsed.fileName };
}
