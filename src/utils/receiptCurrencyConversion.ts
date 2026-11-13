// BUG-01 (ürün kararı A): uygulama tek para birimlidir. Farklı para birimli fiş,
// kullanıcının gerçekten ödediği uygulama para birimi tutarıyla kaydedilir.
import type { ParsedReceipt } from '../services/geminiService';
import { roundMoney, roundUnitRate } from './moneyMath';

function code(value: string | null | undefined): string {
  return String(value ?? '').trim().toUpperCase();
}

/** Okunamayan (boş) para birimi uygulama para birimi sayılır; çeviri istenmez. */
export function receiptNeedsCurrencyConversion(receipt: ParsedReceipt, appCurrency: string): boolean {
  const receiptCode = code(receipt.currency);
  return receiptCode !== '' && receiptCode !== code(appCurrency);
}

/**
 * Bütün para alanlarını ödenen/basılı toplam oranıyla ölçekler; başlık toplamı
 * tam olarak `paidTotal` olur (ADR-004: başlık otoritedir, kalem kuruş farkı
 * kabul edilir). Orijinal para birimi ve toplam `original` alanında taşınır.
 * Girdi nesnesi değiştirilmez.
 */
export function convertReceiptToAppCurrency(
  receipt: ParsedReceipt,
  appCurrency: string,
  paidTotal: number,
): ParsedReceipt {
  const originalTotal = Number(receipt.voucher_issued && receipt.document_type === 'container_return_voucher'
    ? receipt.voucher_issued.amount
    : receipt.total) || 0;
  const rate = originalTotal > 0 ? paidTotal / originalTotal : 1;
  const money = (value: number | null | undefined) => (value == null ? value : roundMoney(Number(value) * rate));

  return {
    ...receipt,
    currency: code(appCurrency),
    total: originalTotal > 0 ? roundMoney(paidTotal) : roundMoney(Number(receipt.total) || 0),
    container_deposit_paid: money(receipt.container_deposit_paid) ?? undefined,
    container_voucher_used: money(receipt.container_voucher_used) ?? undefined,
    voucher_issued: receipt.voucher_issued
      ? { ...receipt.voucher_issued, amount: roundMoney(receipt.voucher_issued.amount * rate) }
      : receipt.voucher_issued,
    items: receipt.items.map(item => ({
      ...item,
      unit_price: roundUnitRate(Number(item.unit_price) * rate),
      total_price: roundMoney(Number(item.total_price) * rate),
      line_discount: money(item.line_discount) ?? item.line_discount,
      list_line_total_before_discount: money(item.list_line_total_before_discount)
        ?? item.list_line_total_before_discount,
    })),
    original: { currency: code(receipt.currency), total: roundMoney(originalTotal) },
  };
}
