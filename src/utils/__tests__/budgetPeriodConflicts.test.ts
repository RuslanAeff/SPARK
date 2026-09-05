import { findShadowedBudgetIds, periodsOverlap } from '../budgetPeriodConflicts';

describe('periodsOverlap', () => {
  it('sınır günü paylaşan aralıkları çakışma sayar', () => {
    expect(periodsOverlap('2026-08-23', '2026-09-22', '2026-09-22', '2026-10-21')).toBe(true);
  });

  it('bitişik ama ayrık aralıkları çakışma saymaz', () => {
    expect(periodsOverlap('2026-08-23', '2026-09-22', '2026-09-23', '2026-10-22')).toBe(false);
  });
});

describe('findShadowedBudgetIds', () => {
  it('çakışma yokken hiçbir kaydı gölgelemez', () => {
    const shadowed = findShadowedBudgetIds([
      { id: 1, period_start: '2026-07-23', period_end: '2026-08-22' },
      { id: 2, period_start: '2026-08-23', period_end: '2026-09-22' },
    ]);
    expect(shadowed.size).toBe(0);
  });

  it('aynı günü kapsayan iki dönemde son yazılanı yetkili sayar', () => {
    // Ekranda iki "MEVCUT" rozetine yol açan gerçek veri şekli.
    const shadowed = findShadowedBudgetIds([
      { id: 5, period_start: '2026-08-23', period_end: '2026-09-22' },
      { id: 9, period_start: '2026-09-01', period_end: '2026-09-30' },
    ]);
    expect(shadowed.has(9)).toBe(false);
    expect(shadowed.has(5)).toBe(true);
  });

  it('gölgelenen kayıt başkasını gölgeleyemez', () => {
    // 9 yetkilidir; 7 onunla çakıştığı için gölgelenir. 7 gölgede olduğu için
    // kendisiyle çakışan 3'ü gölgeleyemez, aksi halde kullanıcı 9'u silince
    // yetkili satır beklenmedik biçimde değişirdi.
    const shadowed = findShadowedBudgetIds([
      { id: 9, period_start: '2026-09-10', period_end: '2026-09-20' },
      { id: 7, period_start: '2026-09-15', period_end: '2026-09-25' },
      { id: 3, period_start: '2026-09-22', period_end: '2026-09-28' },
    ]);
    expect(shadowed.has(9)).toBe(false);
    expect(shadowed.has(7)).toBe(true);
    expect(shadowed.has(3)).toBe(false);
  });

  it('dönem sınırı eksik legacy satırları değerlendirme dışı bırakır', () => {
    const shadowed = findShadowedBudgetIds([
      { id: 4, period_start: null, period_end: null },
      { id: 2, period_start: '2026-09-01', period_end: '2026-09-30' },
    ]);
    expect(shadowed.size).toBe(0);
  });
});
