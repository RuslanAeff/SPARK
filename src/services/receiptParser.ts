// S.P.A.R.K. — Receipt Parser (process Gemini output into DB)
import { ParsedReceipt, ParsedItem } from './geminiService';
import { ExpenseDao } from '../db/expenseDao';
import { VendorDao } from '../db/vendorDao';
import { CategoryDao } from '../db/categoryDao';
import { normalizeToYYYYMMDD } from '../utils/dateUtils';

const CATEGORY_MAP: Record<string, string> = {
  'market': 'Market',
  'süpermarket': 'Market',
  'supermarket': 'Market',
  'grocery': 'Market',
  'restoran': 'Restoran',
  'restaurant': 'Restoran',
  'fast food': 'Fast Food',
  'fastfood': 'Fast Food',
  'kafe': 'Kafe',
  'cafe': 'Kafe',
  'coffee': 'Kafe',
  'giyim': 'Giyim',
  'clothing': 'Giyim',
  'elektronik': 'Elektronik',
  'electronics': 'Elektronik',
  'ev eşyası': 'Ev Eşyası',
  'home': 'Ev Eşyası',
  'ilaç': 'İlaç',
  'pharmacy': 'İlaç',
  'yakıt': 'Yakıt',
  'fuel': 'Yakıt',
  'gas': 'Yakıt',
  'diğer': 'Diğer',
  'other': 'Diğer',
};

async function resolveCategory(suggestedCategory: string): Promise<number> {
  const normalized = (suggestedCategory || '').toLowerCase().trim();
  const mapped = CATEGORY_MAP[normalized] || suggestedCategory;
  
  const category = await CategoryDao.findByName(mapped);
  if (category) return category.id;
  
  // Try finding parent category
  for (const [key, value] of Object.entries(CATEGORY_MAP)) {
    if (normalized.includes(key)) {
      const cat = await CategoryDao.findByName(value);
      if (cat) return cat.id;
    }
  }
  
  // Always fallback to "Diğer" — analytics JOIN excludes null category_id
  const other = await CategoryDao.findByName('Diğer');
  if (other) return other.id;
  
  // Last resort: first available category
  const all = await CategoryDao.getAll();
  return all[0]?.id ?? 1;
}

/** Tarayıcıdan "Kaydet" etmeden add-expense formunu doldurmak için (processReceipt ile aynı toplam/kategori mantığı) */
export async function getPrefillFromParsedReceipt(receipt: ParsedReceipt): Promise<{
  amount: string;
  vendorName: string;
  date: string;
  note: string;
  categoryId: number;
}> {
  const vendorName = String(receipt.vendor_name || '').trim() || 'Bilinmeyen';

  // Önce satıcının önceden belirlenmiş varsayılan kategorisi var mı diye bak;
  // varsa Gemini'nin önerisini geç ve kullanıcı tercihini uygula.
  const existingVendor = await VendorDao.findByName(vendorName);
  let primaryCategoryId: number | null =
    existingVendor?.default_category_id != null ? existingVendor.default_category_id : null;

  if (primaryCategoryId == null) {
    const categoryCounts: Record<string, number> = {};
    for (const item of receipt.items || []) {
      const cat = item.suggested_category || 'Diğer';
      categoryCounts[cat] = (categoryCounts[cat] || 0) + 1;
    }
    const primaryCategory = Object.entries(categoryCounts)
      .sort(([, a], [, b]) => b - a)[0]?.[0] || 'Diğer';
    primaryCategoryId = await resolveCategory(primaryCategory);
  }
  const itemsSum = (receipt.items || []).reduce(
    (s, i) => s + (Number.isFinite(Number(i.total_price)) ? Number(i.total_price) : 0),
    0
  );
  const rawTotal = Number(receipt.total);
  const totalAmount =
    Number.isFinite(rawTotal) && rawTotal >= 0 ? rawTotal : itemsSum > 0 ? itemsSum : 0;
  const normalizedDate = normalizeToYYYYMMDD(receipt.date);
  return {
    amount: String(totalAmount),
    vendorName,
    date: normalizedDate,
    note: `Fiş: ${vendorName}`,
    categoryId: primaryCategoryId,
  };
}

export async function processReceipt(receipt: ParsedReceipt): Promise<number> {
  const vendorName = String(receipt.vendor_name || '').trim() || 'Bilinmeyen';
  const existingVendor = await VendorDao.findByName(vendorName);
  const vendorId = existingVendor?.id ?? (await VendorDao.findOrCreate(vendorName));

  // 2. Kategori: satıcı için kullanıcı tarafından belirlenmiş varsayılan varsa onu
  // kullan, yoksa Gemini'nin item başına önerilerinden çoğunluğu hesapla.
  let primaryCategoryId: number;
  if (existingVendor?.default_category_id != null) {
    primaryCategoryId = existingVendor.default_category_id;
  } else {
    const categoryCounts: Record<string, number> = {};
    for (const item of receipt.items) {
      const cat = item.suggested_category || 'Diğer';
      categoryCounts[cat] = (categoryCounts[cat] || 0) + 1;
    }
    const primaryCategory = Object.entries(categoryCounts)
      .sort(([, a], [, b]) => b - a)[0]?.[0] || 'Diğer';
    primaryCategoryId = await resolveCategory(primaryCategory);
  }
  const normalizedDate = normalizeToYYYYMMDD(receipt.date);

  const itemsSum = (receipt.items || []).reduce(
    (s, i) => s + (Number.isFinite(Number(i.total_price)) ? Number(i.total_price) : 0),
    0
  );
  const rawTotal = Number(receipt.total);
  const totalAmount =
    Number.isFinite(rawTotal) && rawTotal >= 0 ? rawTotal : itemsSum > 0 ? itemsSum : 0;
  
  // 3. Create expense header
  const expenseId = await ExpenseDao.create({
    vendor_id: vendorId,
    category_id: primaryCategoryId,
    total_amount: totalAmount,
    currency: receipt.currency || 'PLN',
    note: `Fiş: ${vendorName}`,
    receipt_uri: null,
    date: normalizedDate,
  });

  try {
    const { appendReceiptSavedNotification } = await import('../notifications/buildNotifications');
    await appendReceiptSavedNotification(vendorName, expenseId);
  } catch {
    /* bildirim isteğe bağlı */
  }
  
  // 4. Add line items (coerce numbers in case Gemini returns strings)
  for (const item of receipt.items) {
    const itemCategoryId = await resolveCategory(item.suggested_category || 'Diğer');
    const qty = Number(item.quantity) || 1;
    const unitPrice = Number(item.unit_price) ?? 0;
    const totalPrice = Number(item.total_price) ?? unitPrice * qty;
    await ExpenseDao.addItem({
      expense_id: expenseId,
      name: String(item.name || '').trim() || 'Ürün',
      turkish_name: item.turkish_name || undefined,
      quantity: qty,
      unit_price: unitPrice,
      total_price: totalPrice,
      category_id: itemCategoryId,
      line_discount: item.line_discount != null ? Number(item.line_discount) : 0,
      list_line_total_before_discount:
        item.list_line_total_before_discount != null
          ? Number(item.list_line_total_before_discount)
          : null,
    } as any);
  }

  if (receipt.items?.length) {
    await ExpenseDao.syncExpenseTotal(expenseId);
  }
  
  return expenseId;
}
