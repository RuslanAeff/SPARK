// S.P.A.R.K. — Dönem sonu harcama projeksiyonu (saf modül, leaf)
//
// Bu modül SADECE sayısal hesabı yapar: "bugüne kadarki günlük harcamalardan
// yola çıkarak dönem sonunda ne kadar harcanmış olacak?" Dönemin BAŞLANGICI
// (takvim ayı mı, bütçe döngüsü mü) ve hangi bütçeyle kıyaslanacağı çağıranın
// sorumluluğundadır (bkz. app/(tabs)/analytics.tsx — projectionInfo).
//
// React / DB importu yok → test db mock'u olmadan çalışır.

export interface SpendingProjectionInput {
  /** Dönem başından bugüne, GÜN SIRASIYLA günlük harcama toplamları (boş günler 0). */
  dailyTotals: number[];
  /** Dönemde şu ana kadar gerçekleşen toplam harcama (fiş toplamı — dailyTotals'ın toplamıyla aynı olmalı). */
  currentSpent: number;
  /** Dönemin bitimine kalan gün sayısı. */
  daysLeft: number;
  /** Kıyaslanacak bütçe (ör. borç nakit akışıyla düzeltilmiş effectiveBudget). 0 veya altı = bütçe yok. */
  effectiveBudget: number;
}

export interface SpendingProjectionResult {
  /** Dönem sonunda ulaşılması beklenen toplam harcama. */
  projected: number;
  /** Kalan günler için kullanılan, aykırı değerlerden arındırılmış günlük tempo. */
  dailyPace: number;
  /** Kırpma uygulanmamış ham günlük tempo (currentSpent / geçen gün). */
  naiveDailyPace: number;
  status: 'safe' | 'warn' | 'over' | 'no_budget';
  /** (projected - effectiveBudget) / effectiveBudget * 100, tek ondalık yuvarlanmış. Bütçe yoksa null. */
  deltaPct: number | null;
  /** naive tempo, kırpılmış temponun 1.5 katından fazlaysa true (tek seferlik büyük harcama var demektir). */
  hasOutlier: boolean;
}

/**
 * Outlier'a dirençli günlük tempo: en yüksek %20'lik dilim (kira, fatura,
 * elektronik gibi tek seferlik büyük harcamalar) kırpılır, kalanların
 * ortalaması kalan günler için tempo olarak kullanılır. Gerçek harcanan
 * (currentSpent) hiç değişmez — sadece GELECEK tahmini gürültüden arındırılır.
 */
export function computeSpendingProjection(input: SpendingProjectionInput): SpendingProjectionResult {
  const { dailyTotals, currentSpent, daysLeft, effectiveBudget } = input;

  const sorted = [...dailyTotals].sort((a, b) => a - b);
  const trimCount = Math.floor(sorted.length * 0.2);
  const trimmed = trimCount > 0 ? sorted.slice(0, sorted.length - trimCount) : sorted;
  const trimmedSum = trimmed.reduce((s, v) => s + v, 0);
  const dailyPace = trimmed.length > 0 ? trimmedSum / trimmed.length : 0;
  const naiveDailyPace = dailyTotals.length > 0 ? currentSpent / dailyTotals.length : 0;

  const projected = currentSpent + daysLeft * dailyPace;

  let status: SpendingProjectionResult['status'] = 'no_budget';
  let deltaPct: number | null = null;
  if (effectiveBudget > 0) {
    const pct = ((projected - effectiveBudget) / effectiveBudget) * 100;
    deltaPct = Math.round(pct * 10) / 10;
    if (projected > effectiveBudget * 1.02) status = 'over';
    else if (projected < effectiveBudget * 0.98) status = 'safe';
    else status = 'warn';
  }

  return {
    projected,
    dailyPace,
    naiveDailyPace,
    status,
    deltaPct,
    hasOutlier: dailyPace > 0 && naiveDailyPace > dailyPace * 1.5,
  };
}
