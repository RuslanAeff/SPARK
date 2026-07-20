// S.P.A.R.K. — Borç nakit-akışı matematiği (saf modül, leaf)
//
// Borç, fiş/harcama bütünlüğünü BOZMADAN bütçeyi etkiler. Model = NAKİT AKIŞI:
//   • Borç ALINAN döngüde harcanabilir tutar +amount artar.
//   • Geri ÖDENEN döngüde harcanabilir tutar −payment azalır.
// İki döngü toplamında borç + ödeme birbirini götürür (+100 −100 = 0) → hayalî
// para oluşmaz; tüketim (totalSpent) her zaman gerçek fiş toplamıdır.
//
// EK GELİR (extra_incomes — banka bonusu, hediye, tek seferlik ek iş) aynı
// nakit-akışı modelinin + yönlü tek terimidir: borçtan farkı geri ödenmemesidir,
// bu yüzden hiç eksilmez ve "açık borç" rozetine girmez. Düştüğü döngüyü `date`
// belirler → sonraki döngüye sarkmaz (bütçe planı temiz kalır).
//
// effectiveBudget = monthlyBudget + borrowedIn − repaidIn + extraIncomeIn
// remaining       = effectiveBudget − totalSpent
// isOverBudget    = remaining < 0
// percentage      = effectiveBudget'a göre (kullanıcı kararı: remaining ile
//                   tutarlı, bar şişmez/yanıltmaz).
//
// React / DB importu yok → util ve testler db mock'u olmadan kullanabilir.

export interface DebtCashFlowInput {
  /** Planlanan döngü bütçesi (debt'ten bağımsız). */
  monthlyBudget: number;
  /** Döngüde gerçekleşen toplam harcama (fiş bütün — bölünmez). */
  totalSpent: number;
  /** Bu döngüde alınan borç toplamı (date ∈ döngü). */
  borrowedIn: number;
  /** Bu döngüde yapılan geri ödeme toplamı (payment.date ∈ döngü). */
  repaidIn: number;
  /**
   * Bu döngüde elde edilen **ek gelir** toplamı (extra_incomes.date ∈ döngü).
   * Borçtan farkı: geri ödenmez, hiç eksilmez → yalnız + yönlü tek terim.
   * Opsiyonel; verilmezse 0 (ek gelir öncesi davranış birebir korunur).
   */
  extraIncomeIn?: number;
}

export interface DebtCashFlowResult {
  /** borrowedIn − repaidIn (döngünün net borç nakit akışı; +/−). */
  netDebtFlow: number;
  /** Döngünün ek gelir toplamı (yalnız +; geri ödeme yok). */
  extraIncomeIn: number;
  /** monthlyBudget + netDebtFlow + extraIncomeIn. */
  effectiveBudget: number;
  /** effectiveBudget − totalSpent. */
  remaining: number;
  /** Harcama yüzdesi (0–100), effectiveBudget tabanlı. */
  percentage: number;
  /** remaining < 0. */
  isOverBudget: boolean;
}

/** Borçla düzeltilmiş döngü bütçesi (nakit-akışı modeli). */
export function computeDebtAdjustedBudget(input: DebtCashFlowInput): DebtCashFlowResult {
  const monthlyBudget = Number.isFinite(input.monthlyBudget) ? input.monthlyBudget : 0;
  const totalSpent = Number.isFinite(input.totalSpent) ? input.totalSpent : 0;
  const borrowedIn = Number.isFinite(input.borrowedIn) ? input.borrowedIn : 0;
  const repaidIn = Number.isFinite(input.repaidIn) ? input.repaidIn : 0;
  const extraIncomeIn = Number.isFinite(input.extraIncomeIn) ? (input.extraIncomeIn as number) : 0;

  const netDebtFlow = borrowedIn - repaidIn;
  const effectiveBudget = monthlyBudget + netDebtFlow + extraIncomeIn;
  const remaining = effectiveBudget - totalSpent;
  const percentage =
    effectiveBudget > 0
      ? Math.min(100, Math.round((totalSpent / effectiveBudget) * 100))
      : 0;

  return {
    netDebtFlow,
    extraIncomeIn,
    effectiveBudget,
    remaining,
    percentage,
    isOverBudget: remaining < 0,
  };
}
