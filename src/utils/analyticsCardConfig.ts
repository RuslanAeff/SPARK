export interface AnalyticsCardConfig {
  active: string[];
  hidden: string[];
}

export type AnalyticsCardEditExitAction = 'confirm' | 'discard';

/** Kart kimliklerinin kanonik sırasını koruyarak tümünü kullanılabilir yapar. */
export function buildAllCardsHiddenConfig(
  cardIds: readonly string[],
): AnalyticsCardConfig {
  return {
    active: [],
    hidden: Array.from(new Set(cardIds)),
  };
}

export function hasActiveAnalyticsCard(activeIds: readonly string[]): boolean {
  return activeIds.length > 0;
}

/**
 * Düzenleme çıkışını tek yerde çözer:
 * - onaylanan boş taslak geçersizdir ve çıkış engellenir;
 * - vazgeçilen taslak, son onaylanmış yapılandırmaya geri döner;
 * - dönen diziler kopyadır; taslak ile kalıcı durum aynı referansı paylaşmaz.
 */
export function resolveAnalyticsCardEditExit(
  draft: AnalyticsCardConfig,
  committed: AnalyticsCardConfig,
  action: AnalyticsCardEditExitAction,
): AnalyticsCardConfig | null {
  if (action === 'confirm' && !hasActiveAnalyticsCard(draft.active)) return null;

  const source = action === 'confirm' ? draft : committed;
  return {
    active: [...source.active],
    hidden: [...source.hidden],
  };
}
