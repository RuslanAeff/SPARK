export const MEASUREMENT_UNITS = ['piece', 'kg', 'g', 'l', 'ml'] as const;

export type MeasurementInputUnit = typeof MEASUREMENT_UNITS[number];
export type MeasurementUnit = 'piece' | 'kg' | 'l';

export function sanitizeMeasurementUnit(value: unknown): MeasurementUnit {
  const normalized = String(value ?? '').trim().toLowerCase();
  if (normalized === 'kg' || normalized === 'g') return 'kg';
  if (normalized === 'l' || normalized === 'lt' || normalized === 'liter'
    || normalized === 'litre' || normalized === 'ml') return 'l';
  return 'piece';
}

/** g/ml girdisini finansal satır hesabından önce kg/L tabanına çevirir. */
export function normalizeMeasurementInput(
  quantity: number,
  inputUnit: MeasurementInputUnit | string | null | undefined,
): { quantity: number; measurementUnit: MeasurementUnit } {
  const rawUnit = String(inputUnit ?? 'piece').trim().toLowerCase();
  if (rawUnit === 'g') return { quantity: quantity / 1000, measurementUnit: 'kg' };
  if (rawUnit === 'ml') return { quantity: quantity / 1000, measurementUnit: 'l' };
  return { quantity, measurementUnit: sanitizeMeasurementUnit(rawUnit) };
}

/** Küçük kg/L değerlerini düzenleme formunda daha okunur g/ml olarak sunar. */
export function measurementInputFromStored(
  quantity: number,
  unit: MeasurementUnit | string | null | undefined,
): { quantity: number; inputUnit: MeasurementInputUnit } {
  const canonical = sanitizeMeasurementUnit(unit);
  if (canonical === 'kg' && quantity > 0 && quantity < 1) {
    return { quantity: quantity * 1000, inputUnit: 'g' };
  }
  if (canonical === 'l' && quantity > 0 && quantity < 1) {
    return { quantity: quantity * 1000, inputUnit: 'ml' };
  }
  return { quantity, inputUnit: canonical };
}

function formatNumber(value: number): string {
  return Number(value.toFixed(3)).toString().replace('.', ',');
}

export function formatMeasurementQuantity(
  quantity: number,
  unit: MeasurementUnit | string | null | undefined,
): string {
  const display = measurementInputFromStored(quantity, unit);
  if (display.inputUnit === 'piece') return `${formatNumber(display.quantity)}×`;
  return `${formatNumber(display.quantity)} ${display.inputUnit === 'l' ? 'L' : display.inputUnit}`;
}

export function measurementUnitSuffix(
  unit: MeasurementUnit | string | null | undefined,
  pieceLabel: string = 'piece',
): string {
  const canonical = sanitizeMeasurementUnit(unit);
  if (canonical === 'kg') return '/kg';
  if (canonical === 'l') return '/L';
  return `/${pieceLabel}`;
}
