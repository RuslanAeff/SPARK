// S.P.A.R.K. — Receipt Parser (process Gemini output into DB)
import { ParsedReceipt, ParsedItem } from './geminiService';
import { getDatabase } from '../db/database';
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

  // 3. Kalem kategorilerini transaction ÖNCESİ çöz (okuma); yazma kısa transaction'da.
  const rawItems = receipt.items || [];
  const resolvedItems: Array<{
    item: ParsedItem;
    itemCategoryId: number;
    qty: number;
    unitPrice: number;
    totalPrice: number;
  }> = [];
  for (const item of rawItems) {
    const itemCategoryId = await resolveCategory(item.suggested_category || 'Diğer');
    const qty = Number(item.quantity) || 1;
    const unitPrice = Number(item.unit_price) || 0;
    const totalPrice = Number(item.total_price) || unitPrice * qty;
    resolvedItems.push({ item, itemCategoryId, qty, unitPrice, totalPrice });
  }

  // 4. Header + kalemler TEK transaction'da: ya hepsi kaydolur ya hiçbiri.
  // (Eskiden header create + ayrı addItem'lar transaction dışındaydı → bir kalemde
  // hata olursa "fiş var ama ürünler yok" tutarsızlığı oluşuyordu — §7.3.)
  const db = await getDatabase();
  let expenseId = 0;
  await db.withTransactionAsync(async () => {
    expenseId = await ExpenseDao.create({
      vendor_id: vendorId,
      category_id: primaryCategoryId,
      total_amount: totalAmount,
      currency: receipt.currency || 'PLN',
      note: `Fiş: ${vendorName}`,
      receipt_uri: null,
      date: normalizedDate,
    });
    for (const r of resolvedItems) {
      await ExpenseDao.addItem({
        expense_id: expenseId,
        name: String(r.item.name || '').trim() || 'Ürün',
        turkish_name: r.item.turkish_name || undefined,
        quantity: r.qty,
        unit_price: r.unitPrice,
        total_price: r.totalPrice,
        category_id: r.itemCategoryId,
        line_discount: r.item.line_discount != null ? Number(r.item.line_discount) : 0,
        list_line_total_before_discount:
          r.item.list_line_total_before_discount != null
            ? Number(r.item.list_line_total_before_discount)
            : null,
      } as any);
    }
    // NOT: Burada syncExpenseTotal ÇAĞRILMAZ. Fişin basılı toplamı (totalAmount =
    // Gemini'nin okuduğu "SUMA PLN") gerçek ödenen tutardır; AI bir kalemi atlarsa
    // bile dashboard/bütçe doğru kalsın. Kullanıcı edit-items'ta kalem düzenlerse
    // orada syncExpenseTotal zaten çağrılıp toplam güncel kalemlerle eşitlenir.
  });

  // Bildirim transaction dışı (isteğe bağlı; kritik değil)
  try {
    const { appendReceiptSavedNotification } = await import('../notifications/buildNotifications');
    await appendReceiptSavedNotification(vendorName, expenseId);
  } catch {
    /* bildirim isteğe bağlı */
  }

  return expenseId;
}
