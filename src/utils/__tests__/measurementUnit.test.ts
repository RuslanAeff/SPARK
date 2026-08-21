import {
  formatMeasurementQuantity,
  measurementInputFromStored,
  normalizeMeasurementInput,
  sanitizeMeasurementUnit,
} from '../measurementUnit';

describe('measurementUnit', () => {
  it('gram ve mililitre girdilerini kanonik kg/L miktarına çevirir', () => {
    expect(normalizeMeasurementInput(530, 'g')).toEqual({ quantity: 0.53, measurementUnit: 'kg' });
    expect(normalizeMeasurementInput(750, 'ml')).toEqual({ quantity: 0.75, measurementUnit: 'l' });
  });

  it('küçük kanonik miktarı kullanıcıya g/ml olarak geri sunar', () => {
    expect(measurementInputFromStored(0.53, 'kg')).toEqual({ quantity: 530, inputUnit: 'g' });
    expect(formatMeasurementQuantity(0.53, 'kg')).toBe('530 g');
    expect(formatMeasurementQuantity(2, 'piece')).toBe('2×');
  });

  it('bilinmeyen dış değeri adet olarak kapatır', () => {
    expect(sanitizeMeasurementUnit('box')).toBe('piece');
  });
});
