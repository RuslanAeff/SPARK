import { ContainerDepositDao } from '../db/containerDepositDao';
// S.P.A.R.K. — Receipt Parser (process Gemini output into DB)
import { ParsedReceipt, ParsedItem, validateParsedReceipt } from './geminiService';
import * as Crypto from 'expo-crypto';
import { getDatabase } from '../db/database';
import { ExpenseDao } from '../db/expenseDao';
import { VendorDao } from '../db/vendorDao';
import { CategoryDao } from '../db/categoryDao';
import { normalizeToYYYYMMDD } from '../utils/dateUtils';
import {
  roundMoney,
  roundUnitRate,
  sumMoney,
} from '../utils/moneyMath';
import { normalizeReceiptItemAmounts } from '../utils/receiptMoney';
import { normalizeMeasurementInput } from '../utils/measurementUnit';
import { canonicalReceiptCategoryName } from '../utils/receiptCategory';
import { sanitizePurchaseVoucherExpiry } from '../utils/containerVoucherRules';
import { createCategoryNameResolver } from '../utils/categoryNameResolver';
import { isReceiptDateTooFarAhead } from '../utils/receiptDateRules';

/**
 * Kategoriler fiş başına BİR kez okunur (PERF-04). Bulunamayan ad her zaman
 * "Diğer"e düşer — analiz JOIN'i NULL category_id'yi dışlar.
 */
async function createReceiptCategoryResolver(): Promise<
  (item: Pick<ParsedItem, 'category_key' | 'suggested_category'>) => number
> {
  const resolveName = createCategoryNameResolver(await CategoryDao.getAll());
  return (item) => resolveName(canonicalReceiptCategoryName(
    item.category_key,
    item.suggested_category,
  ));
}

export async function processReceipt(receipt: ParsedReceipt): Promise<number> {
  const validation = validateParsedReceipt(receipt);
  if (!validation.valid) throw new Error(`INVALID_RECEIPT_${validation.code}`);
  // BUG-17: kayıt sınırında ikinci güvence; tarayıcı kullanıcıya önce düzelttirir.
  if (isReceiptDateTooFarAhead(normalizeToYYYYMMDD(receipt.date))) {
    throw new Error('INVALID_RECEIPT_future_date');
  }
  if (receipt.document_type === 'container_return_voucher') {
    throw new Error('CONTAINER_VOUCHER_REQUIRES_VOUCHER_FLOW');
  }
  const vendorName = String(receipt.vendor_name || '').trim() || 'Bilinmeyen';
  const existingVendor = await VendorDao.findByName(vendorName);
  const resolveCategory = await createReceiptCategoryResolver();
  const vendorId = existingVendor?.id ?? (await VendorDao.findOrCreate(vendorName));

  // 2. Kategori: satıcı için kullanıcı tarafından belirlenmiş varsayılan varsa onu
  // kullan, yoksa Gemini'nin item başına önerilerinden çoğunluğu hesapla.
  let primaryCategoryId: number;
  if (existingVendor?.default_category_id != null) {
    primaryCategoryId = existingVendor.default_category_id;
  } else {
    const categoryCounts: Record<string, number> = {};
    for (const item of receipt.items) {
      const cat = canonicalReceiptCategoryName(item.category_key, item.suggested_category);
      categoryCounts[cat] = (categoryCounts[cat] || 0) + 1;
    }
    const primaryCategory = Object.entries(categoryCounts)
      .sort(([, a], [, b]) => b - a)[0]?.[0] || 'Diğer';
    primaryCategoryId = resolveCategory({ suggested_category: primaryCategory });
  }
  const normalizedDate = normalizeToYYYYMMDD(receipt.date);
  const derivedDepositPaid = sumMoney(
    (receipt.items || [])
      .filter(item => item.financial_kind === 'container_deposit')
      .map(item => Math.max(0, Number(item.total_price) || 0)),
  );
  const containerDepositPaid = roundMoney(Math.max(
    0,
    Number(receipt.container_deposit_paid) || derivedDepositPaid,
  ));
  const containerVoucherUsed = roundMoney(Math.max(0, Number(receipt.container_voucher_used) || 0));

  const itemsSum = sumMoney(
    (receipt.items || []).map((item) => Number(item.total_price)).filter(Number.isFinite),
  );
  const rawTotal = Number(receipt.total);
  const totalAmount =
    Number.isFinite(rawTotal) && rawTotal >= 0 ? roundMoney(rawTotal) : itemsSum > 0 ? itemsSum : 0;

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
    const itemCategoryId = resolveCategory(item);
    const { quantity: rawQty, unitPrice, totalPrice } = normalizeReceiptItemAmounts(item);
    const measurement = normalizeMeasurementInput(rawQty, item.measurement_unit);
    const canonicalUnitPrice = measurement.quantity > 0 && totalPrice > 0
      ? roundUnitRate(totalPrice / measurement.quantity)
      : unitPrice;
    resolvedItems.push({
      item: { ...item, measurement_unit: measurement.measurementUnit },
      itemCategoryId,
      qty: measurement.quantity,
      unitPrice: canonicalUnitPrice,
      totalPrice,
    });
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
      // BUG-01: çevrilmiş fişte orijinal tutar notta kalır (dil bağımsız biçim).
      note: receipt.original
        ? `Fiş: ${vendorName} · ${roundMoney(receipt.original.total).toFixed(2)} ${receipt.original.currency}`
        : `Fiş: ${vendorName}`,
      receipt_uri: null,
      date: normalizedDate,
      container_deposit_paid: containerDepositPaid,
      container_voucher_used: containerVoucherUsed,
    });
    for (const r of resolvedItems) {
      await ExpenseDao.addItem({
        expense_id: expenseId,
        name: String(r.item.name || '').trim() || 'Ürün',
        turkish_name: r.item.turkish_name || undefined,
        quantity: r.qty,
        measurement_unit: r.item.measurement_unit ?? 'piece',
        unit_price: r.unitPrice,
        total_price: r.totalPrice,
        category_id: r.itemCategoryId,
        line_discount: r.item.line_discount != null ? roundMoney(Number(r.item.line_discount)) : 0,
        list_line_total_before_discount:
          r.item.list_line_total_before_discount != null
            ? roundMoney(Number(r.item.list_line_total_before_discount))
            : null,
        financial_kind: r.item.financial_kind === 'container_deposit'
          ? 'container_deposit'
          : 'product',
        // Yapılandırılmış Gemini çıktısı yalnız yeni ürünün gösterim/metadatasına
        // yardımcı olur; alias/merge kararı ExpenseDao içindeki yerel kurallardadır.
        product_identity_hint: r.item.product_identity,
      } as any);
    }
    if (containerVoucherUsed > 0) {
      await ContainerDepositDao.syncPurchaseRecovery(expenseId);
    }
    if (receipt.voucher_issued && receipt.voucher_issued.amount > 0) {
      await db.runAsync(
        `INSERT INTO container_deposit_vouchers
          (uid, amount, currency, issued_date, expires_on, status, redeemed_date,
           redemption_expense_id, note, created_at)
         VALUES (?, ?, ?, ?, ?, 'available', NULL, NULL, ?, ?)`,
        [
          Crypto.randomUUID(),
          roundMoney(receipt.voucher_issued.amount),
          receipt.currency || 'PLN',
          normalizedDate,
          sanitizePurchaseVoucherExpiry(normalizedDate, receipt.voucher_issued.expires_on),
          `Voucher: ${vendorName}`,
          new Date().toISOString(),
        ],
      );
    }
    // NOT: Burada syncExpenseTotal ÇAĞRILMAZ. Fişin basılı toplamı (totalAmount =
    // Gemini'nin okuduğu "SUMA PLN") gerçek ödenen tutardır; AI bir kalemi atlarsa
    // bile dashboard/bütçe doğru kalsın. Kullanıcı edit-items'ta kalem düzenlerse
    // orada syncExpenseTotal zaten çağrılıp toplam güncel kalemlerle eşitlenir.
  });

  // Bildirim transaction dışı (isteğe bağlı; kritik değil)
  try {
    const { appendReceiptSavedNotification } = await import('../notifications/receiptNotifications');
    await appendReceiptSavedNotification(expenseId);
  } catch {
    /* bildirim isteğe bağlı */
  }

  return expenseId;
}
