import type { PriceChange } from '../components/analytics/shared';
import { roundUnitRate } from './moneyMath';
import { sanitizeMeasurementUnit, type MeasurementUnit } from './measurementUnit';
import {
  canonicalizeProductLabel,
  productIdentityGroupKey,
} from './productIdentity';

export interface PriceHistoryObservation {
  name: string;
  turkish_name: string | null;
  canonical_product_id?: number | null;
  canonical_name?: string | null;
  date: string;
  quantity: number;
  total_price: number;
  unit_price: number;
  measurement_unit: MeasurementUnit;
}

export type IdentifiedPriceChange = PriceChange & {
  canonicalProductId: number | null;
  canonicalName: string | null;
  productIdentityKey: string;
};

function dailyUnitPrice(rows: PriceHistoryObservation[]): number {
  const totalQuantity = rows.reduce((sum, row) => sum + Math.max(0, Number(row.quantity) || 0), 0);
  const totalSpent = rows.reduce((sum, row) => sum + Math.max(0, Number(row.total_price) || 0), 0);
  if (totalQuantity > 0 && totalSpent > 0) return roundUnitRate(totalSpent / totalQuantity);
  const validRates = rows.map(row => Number(row.unit_price)).filter(rate => rate > 0);
  return validRates.length > 0
    ? roundUnitRate(validRates.reduce((sum, rate) => sum + rate, 0) / validRates.length)
    : 0;
}

/** Aynı ürünü yazım farklarına rağmen birleştirir; farklı ölçü boyutlarını asla karıştırmaz. */
export function buildPriceChanges(rows: PriceHistoryObservation[]): IdentifiedPriceChange[] {
  const groups = new Map<string, PriceHistoryObservation[]>();
  rows.forEach(row => {
    const unit = sanitizeMeasurementUnit(row.measurement_unit);
    const key = productIdentityGroupKey({
      canonicalProductId: row.canonical_product_id,
      name: row.name,
      measurementUnit: unit,
    });
    if (!key) return;
    const group = groups.get(key) ?? [];
    group.push({ ...row, measurement_unit: unit });
    groups.set(key, group);
  });

  const changes: IdentifiedPriceChange[] = [];
  groups.forEach((entries, productIdentityKey) => {
    const byDate = new Map<string, PriceHistoryObservation[]>();
    entries.forEach(entry => {
      const daily = byDate.get(entry.date) ?? [];
      daily.push(entry);
      byDate.set(entry.date, daily);
    });
    const dates = Array.from(byDate.keys()).sort();
    if (dates.length < 2) return;
    const firstPrice = dailyUnitPrice(byDate.get(dates[0])!);
    const lastPrice = dailyUnitPrice(byDate.get(dates[dates.length - 1])!);
    if (firstPrice <= 0 || lastPrice <= 0 || firstPrice === lastPrice) return;
    const latest = byDate.get(dates[dates.length - 1])!.at(-1)!;
    const canonicalProductId = Number.isSafeInteger(latest.canonical_product_id)
      && Number(latest.canonical_product_id) > 0
      ? Number(latest.canonical_product_id)
      : null;
    const fallbackCanonicalName = canonicalizeProductLabel(
      latest.name,
      latest.measurement_unit,
    ).canonicalName;
    const canonicalName = latest.canonical_name?.trim() || fallbackCanonicalName || null;
    const pct = ((lastPrice - firstPrice) / firstPrice) * 100;
    changes.push({
      name: latest.name,
      turkishName: latest.turkish_name,
      canonicalProductId,
      canonicalName,
      productIdentityKey,
      firstPrice,
      lastPrice,
      changePct: Math.round(pct * 10) / 10,
      purchaseCount: entries.length,
      measurementUnit: latest.measurement_unit,
    });
  });

  return changes.sort((a, b) => Math.abs(b.changePct) - Math.abs(a.changePct));
}
