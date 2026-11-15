// S.P.A.R.K. — Alt güvenli boşluk (UI denetimi UX-06)
//
// Kaydırılan içeriğin son öğesinin ve ekran dibine sabit formların, sistem
// gezinme alanı (jest çubuğu ya da üç düğmeli gezinme) ve sekme ekranlarında
// yüzen alt sekme çubuğu tarafından örtülmemesi için gereken alt boşluk.
// Proje kuralı: cihaza özgü alt boşluk sabit padding ile taklit edilmez.
import { createContext, useContext } from 'react';
import * as SafeArea from 'react-native-safe-area-context';
import { Spacing } from '../theme/spacing';
import { TAB_BAR_FLOAT_GAP, TAB_BAR_HEIGHT } from '../theme/layout';

type Insets = { top: number; right: number; bottom: number; left: number };

// Sağlayıcı yoksa (ör. modül yalnız `SafeAreaView` ile taklit edilen testler)
// sıfır inset ile çalışır; hook her render'da aynı bağlamı okur.
const FallbackInsetsContext = createContext<Insets | null>(null);
const InsetsContext =
  (SafeArea as { SafeAreaInsetsContext?: React.Context<Insets | null> }).SafeAreaInsetsContext
  ?? FallbackInsetsContext;

export function useSafeBottomInset(): number {
  return useContext(InsetsContext)?.bottom ?? 0;
}

/**
 * `tab`: içerik yüzen sekme çubuğunun altından geçer (çubuk + boşluk + nefes payı).
 * `screen`: sekme çubuğu olmayan alt ekran; yalnız sistem gezinme alanı + `extra`.
 */
export function useBottomClearance(kind: 'tab' | 'screen', extra: number = Spacing.xl): number {
  const bottom = useSafeBottomInset();
  if (kind === 'tab') return bottom + TAB_BAR_FLOAT_GAP + TAB_BAR_HEIGHT + extra;
  return bottom + extra;
}
