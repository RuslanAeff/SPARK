import { computeDebtAdjustedBudget } from '../debtMath';

describe('computeDebtAdjustedBudget — nakit-akışı modeli', () => {
  it('borç/ödeme yokken klasik bütçeye eşit', () => {
    const r = computeDebtAdjustedBudget({
      monthlyBudget: 1500,
      totalSpent: 129,
      borrowedIn: 0,
      repaidIn: 0,
    });
    expect(r.netDebtFlow).toBe(0);
    expect(r.effectiveBudget).toBe(1500);
    expect(r.remaining).toBe(1371);
    expect(r.isOverBudget).toBe(false);
  });

  // Plandaki birebir örnek: bütçe 1500, PLN, 129'luk fişin 100'ü borçla.
  it('borç alınan döngü: eff +borrowedIn, remaining eksiye düşmez', () => {
    const haz = computeDebtAdjustedBudget({
      monthlyBudget: 1500,
      totalSpent: 129,
      borrowedIn: 100,
      repaidIn: 0,
    });
    expect(haz.effectiveBudget).toBe(1600);
    expect(haz.remaining).toBe(1471);
    expect(haz.isOverBudget).toBe(false);
  });

  it('geri ödenen döngü: eff −repaidIn', () => {
    const tem = computeDebtAdjustedBudget({
      monthlyBudget: 1500,
      totalSpent: 0,
      borrowedIn: 0,
      repaidIn: 100,
    });
    expect(tem.netDebtFlow).toBe(-100);
    expect(tem.effectiveBudget).toBe(1400);
    expect(tem.remaining).toBe(1400);
  });

  it('iki döngü neti: +100 −100 = 0, tüketim 129 (hayalî para yok)', () => {
    const haz = computeDebtAdjustedBudget({ monthlyBudget: 1500, totalSpent: 129, borrowedIn: 100, repaidIn: 0 });
    const tem = computeDebtAdjustedBudget({ monthlyBudget: 1500, totalSpent: 0, borrowedIn: 0, repaidIn: 100 });
    // İki döngünün net borç akışı sıfırlanır.
    expect(haz.netDebtFlow + tem.netDebtFlow).toBe(0);
    // Toplam efektif bütçe = 2 × plan; toplam tüketim = sadece gerçek fiş.
    expect(haz.effectiveBudget + tem.effectiveBudget).toBe(3000);
    expect(haz.remaining + tem.remaining).toBe(3000 - 129);
  });

  it('aynı döngüde hem borç hem ödeme nettenir', () => {
    const r = computeDebtAdjustedBudget({
      monthlyBudget: 1000,
      totalSpent: 200,
      borrowedIn: 300,
      repaidIn: 120,
    });
    expect(r.netDebtFlow).toBe(180);
    expect(r.effectiveBudget).toBe(1180);
    expect(r.remaining).toBe(980);
  });

  it('yüzde effectiveBudget tabanlı (borç bar şişmez)', () => {
    // 750 harcama; plan 1000 → klasikte %75. Borç +500 → eff 1500 → %50.
    const r = computeDebtAdjustedBudget({
      monthlyBudget: 1000,
      totalSpent: 750,
      borrowedIn: 500,
      repaidIn: 0,
    });
    expect(r.effectiveBudget).toBe(1500);
    expect(r.percentage).toBe(50);
  });

  it('aşım: remaining negatif → isOverBudget', () => {
    const r = computeDebtAdjustedBudget({
      monthlyBudget: 1000,
      totalSpent: 1300,
      borrowedIn: 0,
      repaidIn: 100,
    });
    expect(r.effectiveBudget).toBe(900);
    expect(r.remaining).toBe(-400);
    expect(r.isOverBudget).toBe(true);
    expect(r.percentage).toBe(100); // 0-100'e kıstırılır
  });

  it('effectiveBudget <= 0 → yüzde 0 (sıfıra bölme yok)', () => {
    const r = computeDebtAdjustedBudget({
      monthlyBudget: 100,
      totalSpent: 50,
      borrowedIn: 0,
      repaidIn: 200, // net −200 → eff −100
    });
    expect(r.effectiveBudget).toBe(-100);
    expect(r.percentage).toBe(0);
  });

  it('geçersiz (NaN/Infinity) girdiler 0 sayılır', () => {
    const r = computeDebtAdjustedBudget({
      monthlyBudget: NaN as unknown as number,
      totalSpent: Infinity as unknown as number,
      borrowedIn: NaN as unknown as number,
      repaidIn: undefined as unknown as number,
    });
    expect(r.effectiveBudget).toBe(0);
    expect(r.remaining).toBe(0);
    expect(r.percentage).toBe(0);
  });
});
