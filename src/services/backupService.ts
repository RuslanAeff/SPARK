// S.P.A.R.K. — Export / Import (backup) service
// Tarih aralığı bazlı yedek alma ve geri yükleme. Tüm işlemler tek
// SQLite transaction içinde atomik yürütülür; kısmi import riski yoktur.
//
// JSON format: { version, app, exportedAt, range:{start,end}, data:{...} }
// İçerik: expenses + expense_items + referans verilen vendors/categories +
// aralıktaki budgets. Kullanıcı logoları ve fiş görselleri dosya olarak
// dışarı aktarılmaz (sadece metaveri/URI korunur — farklı cihazda çözümsüz
// kalabileceği için import sırasında görsel eksikse sessizce atlanır).
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
  sanitizeText,
  sanitizeQuantity,
  sanitizeUnitPrice,
  stripDangerousKeys,
} from '../utils/inputValidation';

/** Mevcut yedek formatı sürümü.
 *  v1 → ilk sürüm
 *  v2 → vendors.default_category_name + dismissed subscriptions eklendi.
 *       Eski v1 yedekleri hâlâ içe alınabilir; v2 yedekleri eski uygulamaya
 *       yüklenirse UNSUPPORTED_VERSION ile reddedilir. */
export const BACKUP_FORMAT_VERSION = 2;

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
}

/** v2+: kullanıcının "abonelik değil" tepkisi vermiş satıcılar.
 *  Aktif abonelikler import sonrası yerel veriden tespit edilir; dismissed
 *  kayıtlar ise tekrar uyarı çıkmaması için listede tutulur. */
interface ExportedDismissedSubscription {
  vendor_name: string;
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
        unit_price: it.unit_price,
        total_price: it.total_price,
        line_discount: it.line_discount ?? null,
        list_line_total_before_discount: it.list_line_total_before_discount ?? null,
        category_name: it.category_name ?? null,
      };
    });

    expensesOut.push({
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

  // Referans verilen kategoriler + üstleri (parent zincirini tam almak için)
  const allCats = await db.getAllAsync<Category>('SELECT * FROM categories');
  const catById = new Map<number, Category>();
  for (const c of allCats) catById.set(c.id, c);
  const closed = new Set<number>();
  for (const id of categoryIds) {
    let cur: number | null = id;
    while (cur != null && !closed.has(cur)) {
      closed.add(cur);
      cur = catById.get(cur)?.parent_id ?? null;
    }
  }
  const categoriesOut: ExportedCategory[] = [];
  // Parentlar önce — deterministik sıra
  const orderedCats = Array.from(closed).sort((a, b) => {
    const ap = catById.get(a)?.parent_id == null ? 0 : 1;
    const bp = catById.get(b)?.parent_id == null ? 0 : 1;
    if (ap !== bp) return ap - bp;
    return a - b;
  });
  for (const id of orderedCats) {
    const c = catById.get(id);
    if (!c) continue;
    const parent = c.parent_id != null ? catById.get(c.parent_id) ?? null : null;
    categoriesOut.push({
      name: c.name,
      icon: c.icon,
      color: c.color,
      parent_name: parent?.name ?? null,
    });
  }

  const vendorsOut: ExportedVendor[] = [];
  if (vendorNames.size > 0) {
    const names = Array.from(vendorNames);
    const ph = names.map(() => '?').join(',');
    const rows = await db.getAllAsync<
      Vendor & { default_category_name: string | null }
    >(
      `SELECT v.id, v.name, v.logo_uri, v.default_category_id, v.created_at,
              c.name AS default_category_name
         FROM vendors v
         LEFT JOIN categories c ON v.default_category_id = c.id
        WHERE v.name IN (${ph})`,
      names
    );
    for (const v of rows) {
      vendorsOut.push({
        name: v.name,
        logo_uri: v.logo_uri,
        default_category_name: v.default_category_name ?? null,
      });
    }
  }

  // Dismissed abonelik kayıtları — vendor adı üzerinden taşınır
  const dismissedSubsRows = await db.getAllAsync<{ vendor_name: string }>(
    `SELECT v.name AS vendor_name
       FROM subscriptions s
       JOIN vendors v ON s.vendor_id = v.id
      WHERE s.status = 'dismissed'`
  );
  const dismissedSubsOut: ExportedDismissedSubscription[] = dismissedSubsRows.map((r) => ({
    vendor_name: r.vendor_name,
  }));

  // Bütçeler: aralıkta kalan YYYY-MM ayları
  const months = monthsInRange(range);
  const budgetRows = await db.getAllAsync<{
    monthly_amount: number;
    currency: string;
    start_date: string;
  }>(
    `SELECT monthly_amount, currency, start_date FROM budgets WHERE active = 1`
  );
  const budgetsOut: ExportedBudget[] = budgetRows
    .filter(b => months.has(b.start_date))
    .map(b => ({
      monthly_amount: b.monthly_amount,
      currency: b.currency,
      start_date: b.start_date,
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

  const result: ExportResult = {
    fileUri: file.uri,
    fileName,
    expenseCount: payload.data.expenses.length,
    itemCount,
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

function isBackupPayload(obj: unknown): obj is BackupPayload {
  if (!obj || typeof obj !== 'object') return false;
  const o = obj as Record<string, unknown>;
  if (o.app !== 'S.P.A.R.K.') return false;
  if (typeof o.version !== 'number') return false;
  if (!o.data || typeof o.data !== 'object') return false;
  const d = o.data as Record<string, unknown>;
  if (!Array.isArray(d.expenses) || !Array.isArray(d.categories) ||
      !Array.isArray(d.vendors) || !Array.isArray(d.budgets)) return false;
  return true;
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
  const raw = await file.text();

  let parsed: unknown;
  try {
    parsed = JSON.parse(raw);
  } catch {
    throw new Error('INVALID_JSON');
  }
  if (parsed && typeof parsed === 'object') {
    stripDangerousKeys(parsed as Record<string, unknown>);
  }
  if (!isBackupPayload(parsed)) throw new Error('INVALID_FORMAT');
  if (parsed.version > BACKUP_FORMAT_VERSION) throw new Error('UNSUPPORTED_VERSION');

  return { payload: parsed, fileName: asset.name ?? 'backup.json' };
}

/**
 * İçe aktarım. Tek SQLite transaction içinde çalışır; herhangi bir
 * adımda hata alınırsa tüm değişiklikler geri alınır.
 *
 * Yinelenen kayıt tespiti: bir harcama (date, total_amount, vendor_id, note)
 * dörtlüsü daha önce varsa eklenmez.
 */
export async function importBackupPayload(payload: BackupPayload): Promise<ImportSummary> {
  if (!isBackupPayload(payload)) throw new Error('INVALID_FORMAT');
  const db = await getDatabase();

  const summary: ImportSummary = {
    expensesAdded: 0,
    expensesSkipped: 0,
    itemsAdded: 0,
    categoriesAdded: 0,
    vendorsAdded: 0,
    budgetsAdded: 0,
  };

  await db.withTransactionAsync(async () => {
    // Önce mevcut kategorileri topla
    const existingCats = await db.getAllAsync<Category>('SELECT * FROM categories');
    const catKey = (name: string, parentId: number | null) =>
      `${(name || '').trim().toLowerCase()}::${parentId ?? 'root'}`;
    const catIdByKey = new Map<number | 'none', Map<string, number>>();
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

    // v2+: Dismissed abonelikler — yerel tabloya işle (aktif kayıtlar
    // detection tarafından yeniden üretilecek, sadece status='dismissed'
    // olan kayıtların tekrarını engellemek için).
    const dismissed = payload.data.dismissed_subscriptions ?? [];
    if (dismissed.length > 0) {
      const nowIso = new Date().toISOString();
      for (const d of dismissed) {
        const vname = (d.vendor_name || '').trim().toLowerCase();
        if (!vname) continue;
        const vid = vendorIdByName.get(vname);
        if (!vid) continue;
        await db.runAsync(
          `INSERT INTO subscriptions
             (vendor_id, amount, currency, period_days, last_seen_date,
              next_expected_date, occurrences, status, updated_at)
           VALUES (?, 0, '', 30, ?, ?, 0, 'dismissed', ?)
           ON CONFLICT(vendor_id) DO UPDATE SET
             status = 'dismissed', updated_at = excluded.updated_at`,
          [vid, nowIso.slice(0, 10), nowIso.slice(0, 10), nowIso]
        );
      }
    }

    // Expenses + items
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

      // Yinelenen kontrolü (date + total + vendor + note)
      const dup = await db.getFirstAsync<{ id: number }>(
        `SELECT id FROM expenses
          WHERE date = ? AND ABS(total_amount - ?) < 0.005
            AND COALESCE(vendor_id, -1) = COALESCE(?, -1)
            AND COALESCE(note, '') = COALESCE(?, '')
          LIMIT 1`,
        [date, total, vendorId, note]
      );
      if (dup) { summary.expensesSkipped += 1; continue; }

      const ins = await db.runAsync(
        `INSERT INTO expenses (vendor_id, category_id, total_amount, currency, note, receipt_uri, date)
         VALUES (?, ?, ?, ?, ?, ?, ?)`,
        [vendorId, categoryId, total, currency, note, receiptUri, date]
      );
      const expenseId = Number(ins.lastInsertRowId);
      summary.expensesAdded += 1;

      for (const it of exp.items || []) {
        const itemName = sanitizeText(it.name, 500) || 'Ürün';
        const itemTurkish = it.turkish_name ? sanitizeText(it.turkish_name, 500) : null;
        const qty = sanitizeQuantity(it.quantity);
        const unit = sanitizeUnitPrice(it.unit_price);
        const tp = sanitizeUnitPrice(it.total_price);
        const ld = it.line_discount != null ? sanitizeAmount(it.line_discount) : 0;
        const lb = it.list_line_total_before_discount != null
          ? sanitizeAmount(it.list_line_total_before_discount) : null;
        const itemCatId = it.category_name
          ? nameToId.get(it.category_name.trim().toLowerCase()) ?? null
          : null;
        await db.runAsync(
          `INSERT INTO expense_items
             (expense_id, name, turkish_name, quantity, unit_price, total_price, category_id, line_discount, list_line_total_before_discount)
           VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?)`,
          [expenseId, itemName, itemTurkish, qty, unit, tp, itemCatId, ld, lb]
        );
        summary.itemsAdded += 1;
      }
    }

    // Budgets (ay anahtarında bütçe yoksa ekle — mevcut değeri asla ezmez)
    for (const b of payload.data.budgets || []) {
      const month = typeof b.start_date === 'string' && /^\d{4}-\d{2}$/.test(b.start_date)
        ? b.start_date : null;
      if (!month) continue;
      const existing = await db.getFirstAsync<{ id: number }>(
        'SELECT id FROM budgets WHERE start_date = ? AND active = 1 LIMIT 1',
        [month]
      );
      if (existing) continue;
      const amount = sanitizeAmount(b.monthly_amount);
      const curr = sanitizeText(b.currency || 'PLN', 10);
      await db.runAsync(
        'INSERT INTO budgets (monthly_amount, currency, start_date, active) VALUES (?, ?, ?, 1)',
        [amount, curr, month]
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
