import {
  fromMinorUnits,
  roundMoney,
  roundUnitRate,
  toMinorUnits,
} from './moneyMath';

export interface ReceiptLineAmounts {
  listLineTotal: number;
  discountAmount: number;
  netTotal: number;
  netUnitPrice: number;
}

export interface StoredReceiptItemAmounts {
  quantity: number;
  unitPrice: number;
  totalPrice: number;
}

/** Etiket fiyatı − indirim hesabını kuruş tamsayılarıyla deterministik yapar. */
export function calculateReceiptLineAmounts(
  quantity: number,
  listUnitPrice: number,
  discount: number = 0,
): ReceiptLineAmounts {
  const listMinor = toMinorUnits(quantity * listUnitPrice);
  const discountMinor = Math.min(listMinor, Math.max(0, toMinorUnits(discount)));
  const netMinor = Math.max(0, listMinor - discountMinor);
  const netTotal = fromMinorUnits(netMinor);

  return {
    listLineTotal: fromMinorUnits(listMinor),
    discountAmount: fromMinorUnits(discountMinor),
    netTotal: roundMoney(netTotal),
    netUnitPrice: quantity > 0 ? roundUnitRate(netTotal / quantity) : netTotal,
  };
}

/** AI/backup benzeri dış girdide geçerli sıfır toplamını fallback'ten ayırır. */
export function normalizeReceiptItemAmounts(item: {
  quantity: unknown;
  unit_price: unknown;
  total_price: unknown;
}): StoredReceiptItemAmounts {
  const rawQuantity = Number(item.quantity);
  const quantity = Number.isFinite(rawQuantity) && rawQuantity > 0 ? rawQuantity : 1;
  const rawUnitPrice = Number(item.unit_price);
  const unitPrice = Number.isFinite(rawUnitPrice) ? roundUnitRate(rawUnitPrice) : 0;
  const rawTotalPrice = Number(item.total_price);
  const totalPrice = Number.isFinite(rawTotalPrice)
    ? roundMoney(rawTotalPrice)
    : roundMoney(unitPrice * quantity);
  return { quantity, unitPrice, totalPrice };
}
