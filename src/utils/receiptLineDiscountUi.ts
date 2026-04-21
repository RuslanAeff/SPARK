/** Fiş satırında indirim meta verisi var mı (liste fiyatı / satır indirimi). */
export function lineHasDiscount(item: {
  total_price: number;
  line_discount?: number | null;
  list_line_total_before_discount?: number | null;
}): boolean {
  const net = item.total_price ?? 0;
  const ld = item.line_discount ?? 0;
  const list = item.list_line_total_before_discount;
  if (ld > 0.001) return true;
  if (list != null && list > net + 0.001) return true;
  return false;
}

/** Gösterim için indirim tutarı (pozitif). */
export function effectiveLineDiscount(item: {
  total_price: number;
  line_discount?: number | null;
  list_line_total_before_discount?: number | null;
}): number {
  const net = item.total_price ?? 0;
  const ld = item.line_discount;
  if (ld != null && ld > 0.001) return Number(ld);
  const list = item.list_line_total_before_discount;
  if (list != null && list > net + 0.001) return list - net;
  return 0;
}
