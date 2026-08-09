// S.P.A.R.K. — Para hesapları
// Finansal toplamlar IEEE-754 kayan nokta değerleriyle doğrudan toplanmaz.
// Hesap sırasında iki ondalıklı minor-unit (kuruş/grosz) tamsayıları kullanılır.

const MINOR_UNIT_FACTOR = 100;
const RATE_PRECISION_FACTOR = 10_000;

function shiftDecimal(value: number, places: number): number {
  const [coefficient, exponent = '0'] = String(value).split('e');
  return Number(`${coefficient}e${Number(exponent) + places}`);
}

export function toMinorUnits(value: number): number {
  if (!Number.isFinite(value)) return 0;
  const sign = value < 0 ? -1 : 1;
  return sign * Math.round(shiftDecimal(Math.abs(value), 2));
}

export function fromMinorUnits(value: number): number {
  if (!Number.isFinite(value)) return 0;
  return Math.trunc(value) / MINOR_UNIT_FACTOR;
}

export function roundMoney(value: number): number {
  return fromMinorUnits(toMinorUnits(value));
}

export function sumMoney(values: Iterable<number>): number {
  let minorTotal = 0;
  for (const value of values) minorTotal += toMinorUnits(value);
  return fromMinorUnits(minorTotal);
}

export function subtractMoney(value: number, deduction: number): number {
  return fromMinorUnits(toMinorUnits(value) - toMinorUnits(deduction));
}

/** Birim fiyat, ağırlıklı/adetli ürünlerde satır toplamından daha hassas olabilir. */
export function roundUnitRate(value: number): number {
  if (!Number.isFinite(value)) return 0;
  const sign = value < 0 ? -1 : 1;
  return sign * Math.round(shiftDecimal(Math.abs(value), 4))
    / RATE_PRECISION_FACTOR;
}

export function parseMoneyInput(text: string): number | null {
  const normalized = text.trim().replace(/\s/g, '').replace(',', '.');
  if (!/^[+-]?\d+(?:\.\d*)?$/.test(normalized)) return null;
  const value = Number(normalized);
  return Number.isFinite(value) ? roundMoney(value) : null;
}

export function parseUnitRateInput(text: string): number | null {
  const normalized = text.trim().replace(/\s/g, '').replace(',', '.');
  if (!/^[+-]?\d+(?:\.\d*)?$/.test(normalized)) return null;
  const value = Number(normalized);
  return Number.isFinite(value) ? roundUnitRate(value) : null;
}

/** TextInput'a binary float artığı sızdırmayan kanonik para metni. */
export function formatMoneyInput(value: number): string {
  return roundMoney(value).toFixed(2);
}

export function formatUnitRateInput(value: number): string {
  const fixed = roundUnitRate(value).toFixed(4);
  return fixed.replace(/\.0+$/, '').replace(/(\.\d*?)0+$/, '$1');
}
