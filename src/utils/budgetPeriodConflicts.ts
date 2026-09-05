// S.P.A.R.K. — Bütçe dönemi çakışma çözümü (saf modül)
//
// ADR-008 değişmezi: bir takvim gününü en fazla BİR aktif bütçe dönemi kapsar.
// Bu kural artık yazma yolunda zorlanır; ancak eski sürümlerde çakışan satırlar
// oluşmuş olabilir. Bu modül, veriyi silmeden hangi satırın hesaplamada yetkili
// olduğunu belirler: "son yazılan kazanır" (daha yüksek id).
//
// Saf modül (leaf): React/DB importu yok.

export interface BudgetPeriodLike {
  id: number;
  period_start: string | null;
  period_end: string | null;
}

/** İki kapalı gün aralığı kesişiyor mu? Sınır günleri dahildir. */
export function periodsOverlap(
  aStart: string,
  aEnd: string,
  bStart: string,
  bEnd: string,
): boolean {
  return aStart <= bEnd && aEnd >= bStart;
}

/**
 * Çakışma nedeniyle gölgede kalan kayıtların id'leri.
 *
 * Yüksek id yetkilidir; onunla kesişen daha eski kayıtlar gölgelenir. Gölgeleme
 * geçişlidir: gölgelenen bir kayıt başkasını gölgeleyemez, aksi halde kullanıcı
 * sildiğinde yetkili satır beklenmedik biçimde değişirdi.
 *
 * Dönem sınırı eksik (legacy) satırlar değerlendirme dışı bırakılır; bunlar
 * migration ile doldurulur ve uydurma sınırla çakışma üretilmemelidir.
 */
export function findShadowedBudgetIds(
  budgets: readonly BudgetPeriodLike[],
): Set<number> {
  const shadowed = new Set<number>();
  const authoritative: { start: string; end: string }[] = [];

  const ranked = budgets
    .filter((b) => Boolean(b.period_start) && Boolean(b.period_end))
    .slice()
    .sort((left, right) => right.id - left.id);

  for (const budget of ranked) {
    const start = budget.period_start as string;
    const end = budget.period_end as string;
    const clashes = authoritative.some((accepted) =>
      periodsOverlap(start, end, accepted.start, accepted.end),
    );
    if (clashes) {
      shadowed.add(budget.id);
      continue;
    }
    authoritative.push({ start, end });
  }

  return shadowed;
}
