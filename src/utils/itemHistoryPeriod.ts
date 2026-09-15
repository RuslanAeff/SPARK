import { sumMoney } from './moneyMath';

export type ItemHistoryPeriod = 'all' | 30 | 90 | 365;

interface HistoryValue {
  date: string;
  total_price: number;
  quantity: number;
}

const localDateKey = (date: Date) =>
  `${date.getFullYear()}-${String(date.getMonth() + 1).padStart(2, '0')}-${String(date.getDate()).padStart(2, '0')}`;

/** Bugün dahil N yerel takvim günü; DST için milisaniye çıkarılmaz. */
export function filterItemHistory<T extends HistoryValue>(rows: T[], period: ItemHistoryPeriod, now: Date): T[] {
  if (period === 'all') return rows;
  const start = new Date(now.getFullYear(), now.getMonth(), now.getDate());
  start.setDate(start.getDate() - period + 1);
  const startKey = localDateKey(start);
  const endKey = localDateKey(now);
  return rows.filter(row => row.date >= startKey && row.date <= endKey);
}

export function summarizeItemHistory(rows: HistoryValue[]) {
  const total_spent = sumMoney(rows.map(row => row.total_price));
  const total_quantity = rows.reduce((total, row) => total + row.quantity, 0);
  return {
    total_spent,
    total_quantity,
    purchase_count: rows.length,
    avg_price: total_quantity > 0 ? total_spent / total_quantity : 0,
  };
}
