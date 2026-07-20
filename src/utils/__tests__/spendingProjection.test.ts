import { computeSpendingProjection } from '../spendingProjection';

describe('computeSpendingProjection', () => {
  it('bütçe yokken sadece projeksiyon üretir, status no_budget', () => {
    const r = computeSpendingProjection({
      dailyTotals: [10, 10, 10],
      currentSpent: 30,
      daysLeft: 7,
      effectiveBudget: 0,
    });
    expect(r.projected).toBe(30 + 7 * 10);
    expect(r.status).toBe('no_budget');
    expect(r.deltaPct).toBeNull();
  });

  it('sabit tempoda tahmin = harcanan + kalan gün × günlük ortalama', () => {
    const r = computeSpendingProjection({
      dailyTotals: [20, 20, 20, 20],
      currentSpent: 80,
      daysLeft: 6,
      effectiveBudget: 500,
    });
    expect(r.dailyPace).toBe(20);
    expect(r.naiveDailyPace).toBe(20);
    expect(r.projected).toBe(80 + 6 * 20);
    expect(r.hasOutlier).toBe(false);
  });

  // Gerçek düzenleme buradan çıktı: kira gibi tek seferlik büyük bir harcama,
  // kırpılmamış (naive) temposu üzerinden kalan günlere yayılırsa projeksiyonu
  // abartır. Üst %20 kırpılınca kalan günler için tempo gerçekçi kalmalı.
  it('tek seferlik büyük harcama (kira) kırpılır, projeksiyonu şişirmez', () => {
    // 10 gün: 9 günde 10'ar harcama + 1 günde 1000'lik kira.
    const dailyTotals = [10, 10, 10, 10, 10, 10, 10, 10, 10, 1000];
    const currentSpent = dailyTotals.reduce((s, v) => s + v, 0); // 1090
    const r = computeSpendingProjection({
      dailyTotals,
      currentSpent,
      daysLeft: 20,
      effectiveBudget: 2000,
    });
    // Üst %20 (2 gün) kırpılır → kalan 8 gün hep 10 → trimmedPace = 10.
    expect(r.dailyPace).toBe(10);
    expect(r.naiveDailyPace).toBe(109);
    expect(r.hasOutlier).toBe(true);
    expect(r.projected).toBe(currentSpent + 20 * 10);
  });

  it('projected bütçenin %102\'sini aşarsa over', () => {
    const r = computeSpendingProjection({
      dailyTotals: [100],
      currentSpent: 100,
      daysLeft: 10,
      effectiveBudget: 500, // projected = 100 + 10*100 = 1100 >> 500*1.02
    });
    expect(r.status).toBe('over');
    expect(r.deltaPct).toBeGreaterThan(2);
  });

  it('projected bütçenin %98\'inin altındaysa safe', () => {
    const r = computeSpendingProjection({
      dailyTotals: [5],
      currentSpent: 5,
      daysLeft: 5,
      effectiveBudget: 1000, // projected = 5 + 5*5 = 30, çok altında
    });
    expect(r.status).toBe('safe');
  });

  it('projected bütçenin ±%2 bandındaysa warn', () => {
    const r = computeSpendingProjection({
      dailyTotals: [50],
      currentSpent: 50,
      daysLeft: 9,
      effectiveBudget: 500, // projected = 50 + 9*50 = 500 → tam bütçe
    });
    expect(r.status).toBe('warn');
    expect(r.deltaPct).toBe(0);
  });

  // Bir önceki hata: takvim ayı harcaması ≠ bütçe döngüsü bütçesi kıyaslanıyordu.
  // Bu modül artık dönemi bilmiyor — çağıran (analytics.tsx) hem dailyTotals hem
  // effectiveBudget'ı AYNI döngüden (23 Haz–22 Tem gibi) geçirmekle yükümlü.
  // Burada sadece: aynı döneme ait tutarlı girdilerle sonucun tutarlı kaldığını
  // doğruluyoruz (Dashboard'daki "Kalan" ile aynı taban → safe/over/warn tutarlı).
  it('döngü bütçesiyle tutarlı girdi: dashboard "kalan" ile aynı yönde sonuç verir', () => {
    // Dashboard: harcanan 3201.30, effectiveBudget 3323.68 (bütçe 3423.68 - 100 borç ödemesi).
    const dailyTotals = Array(20).fill(160.065); // 20 gün, ort. günlük ~160
    const currentSpent = 3201.3;
    const r = computeSpendingProjection({
      dailyTotals,
      currentSpent,
      daysLeft: 10,
      effectiveBudget: 3323.68,
    });
    // Dashboard'da bu döngüde sadece 122.38 zł kalmıştı (%96 kullanılmış) →
    // günlük ~28 zł'lik tempo bile kalan bütçeyi büyük ölçüde aşar.
    expect(r.status).toBe('over');
  });

  it('boş gün dizisinde sıfıra bölme olmaz', () => {
    const r = computeSpendingProjection({
      dailyTotals: [],
      currentSpent: 0,
      daysLeft: 30,
      effectiveBudget: 1000,
    });
    expect(r.dailyPace).toBe(0);
    expect(r.naiveDailyPace).toBe(0);
    expect(r.projected).toBe(0);
    expect(r.status).toBe('safe');
  });

  it('daysLeft 0 iken projected = currentSpent', () => {
    const r = computeSpendingProjection({
      dailyTotals: [50, 50],
      currentSpent: 100,
      daysLeft: 0,
      effectiveBudget: 1000,
    });
    expect(r.projected).toBe(100);
  });
});
