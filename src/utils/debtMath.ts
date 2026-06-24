// S.P.A.R.K. — Borç nakit-akışı matematiği (saf modül, leaf)
//
// Borç, fiş/harcama bütünlüğünü BOZMADAN bütçeyi etkiler. Model = NAKİT AKIŞI:
//   • Borç ALINAN döngüde harcanabilir tutar +amount artar.
//   • Geri ÖDENEN döngüde harcanabilir tutar −payment azalır.
// İki döngü toplamında borç + ödeme birbirini götürür (+100 −100 = 0) → hayalî
// para oluşmaz; tüketim (totalSpent) her zaman gerçek fiş toplamıdır.
//
// effectiveBudget = monthlyBudget + borrowedIn − repaidIn
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
}

export interface DebtCashFlowResult {
  /** borrowedIn − repaidIn (döngünün net borç nakit akışı; +/−). */
  netDebtFlow: number;
  /** monthlyBudget + netDebtFlow. */
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

  const netDebtFlow = borrowedIn - repaidIn;
  const effectiveBudget = monthlyBudget + netDebtFlow;
  const remaining = effectiveBudget - totalSpent;
  const percentage =
    effectiveBudget > 0
      ? Math.min(100, Math.round((totalSpent / effectiveBudget) * 100))
      : 0;

  return {
    netDebtFlow,
    effectiveBudget,
    remaining,
    percentage,
    isOverBudget: remaining < 0,
  };
}
