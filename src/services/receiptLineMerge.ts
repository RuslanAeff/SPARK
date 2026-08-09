// Fiş satırları: ayrı "Discount / İndirim" satırlarını bir önceki ürüne yedirir (net fiyat + indirim tutarı)
import type { ParsedItem, ParsedReceipt } from './geminiService';
import { roundMoney, roundUnitRate, subtractMoney, sumMoney } from '../utils/moneyMath';

/**
 * Eşleştirme için küçük harfe çevirir + Türkçe büyük 'İ'nin `toLowerCase()`'te
 * ürettiği birleşik noktayı (U+0307) temizler. Aksi halde 'İndirim' → 'i̇ndirim'
 * olur ve 'indirim' alt dizesini içermez (Hermes'te `toLocaleLowerCase('tr')`
 * güvenilmez olduğundan tercih edilmez).
 */
function normForMatch(s: string): string {
  return s.toLowerCase().split(String.fromCharCode(0x0307)).join('');
}

export function isDiscountLineItem(it: ParsedItem): boolean {
  const tp = Number(it.total_price);
  const up = Number(it.unit_price);
  if (tp < -0.0001 || up < -0.0001) return true;
  const cat = normForMatch(it.suggested_category || '');
  if (cat.includes('indirim')) return true;
  const raw = normForMatch(`${it.name || ''} ${it.turkish_name || ''}`);
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

      const gross = roundMoney(Number(prev.list_line_total_before_discount ?? prev.total_price));
      const cumulativeDiscount = Math.min(
        gross,
        sumMoney([Number(prev.line_discount) || 0, discountAmt]),
      );
      const net = Math.max(0, subtractMoney(gross, cumulativeDiscount));

      prev.list_line_total_before_discount = gross;
      prev.line_discount = cumulativeDiscount;
      prev.total_price = net;
      prev.unit_price = roundUnitRate(net / (prev.quantity || 1));
      continue;
    }

    out.push(it);
  }

  return out;
}

export function finalizeParsedReceipt(receipt: ParsedReceipt): ParsedReceipt {
  const items = mergeDiscountLinesIntoItems(receipt.items || []);
  const itemSum = sumMoney(
    items.map((item) => Number(item.total_price)).filter(Number.isFinite),
  );
  const printedTotal = Number(receipt.total);
  const total = Number.isFinite(printedTotal) && printedTotal >= 0
    ? roundMoney(printedTotal)
    : itemSum;
  return { ...receipt, items, total };
}
