// Fiş satırları: ayrı "Discount / İndirim" satırlarını bir önceki ürüne yedirir (net fiyat + indirim tutarı)
import type { ParsedItem, ParsedReceipt } from './geminiService';

function round2(n: number): number {
  return Math.round(n * 100) / 100;
}

export function isDiscountLineItem(it: ParsedItem): boolean {
  const tp = Number(it.total_price);
  const up = Number(it.unit_price);
  if (tp < -0.0001 || up < -0.0001) return true;
  const cat = (it.suggested_category || '').toLowerCase();
  if (cat.includes('indirim')) return true;
  const raw = `${it.name || ''} ${it.turkish_name || ''}`.toLowerCase();
  if (
    /\bdiscount\b|rabat|obniżka|obnizka|promocja|promo|znizk|zniżk|sparen|rabatt/i.test(raw)
  ) {
    return true;
  }
  return false;
}

/** Ayrı indirim satırlarını önceki ürün satırına birleştirir; ayrı "Discount" kalemi kalmaz */
export function mergeDiscountLinesIntoItems(items: ParsedItem[]): ParsedItem[] {
  if (!items?.length) return [];
  const out: ParsedItem[] = [];

  for (const raw of items) {
    const it: ParsedItem = {
      ...raw,
      quantity: Number(raw.quantity) > 0 ? Number(raw.quantity) : 1,
    };

    if (isDiscountLineItem(it)) {
      if (out.length === 0) continue;
      const prev = out[out.length - 1];
      if (isDiscountLineItem(prev)) {
        continue;
      }

      const lineNeg = Number(it.total_price);
      const discountAmt = Math.abs(
        Number.isFinite(lineNeg) && lineNeg < 0
          ? lineNeg
          : Number(it.unit_price) * (it.quantity || 1)
      );

      const gross = Number(prev.list_line_total_before_discount ?? prev.total_price);
      const net = round2(gross - discountAmt);

      prev.list_line_total_before_discount = round2(gross);
      prev.line_discount = round2(discountAmt + (prev.line_discount || 0));
      prev.total_price = net;
      prev.unit_price = round2(net / (prev.quantity || 1));
      continue;
    }

    out.push(it);
  }

  return out;
}

export function finalizeParsedReceipt(receipt: ParsedReceipt): ParsedReceipt {
  const items = mergeDiscountLinesIntoItems(receipt.items || []);
  const sum = items.reduce((s, i) => s + (Number.isFinite(Number(i.total_price)) ? Number(i.total_price) : 0), 0);
  let total = Number(receipt.total);
  if (items.length > 0 && Number.isFinite(sum) && sum > 0) {
    if (!Number.isFinite(total) || Math.abs(total - sum) > 0.02) {
      total = round2(sum);
    }
  }
  return { ...receipt, items, total: Number.isFinite(total) ? total : sum };
}
