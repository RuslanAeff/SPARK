// S.P.A.R.K. — Yerleşim sabitleri (UI denetimi UX-06)
//
// Yüzen alt sekme çubuğunun geometrisi tek kaynaktadır: hem çubuğun kendisi
// (`app/(tabs)/_layout.tsx`) hem de altına içerik kaydıran sekme ekranları
// (`useBottomClearance`) buradan okur. Eskiden ekranlar çubuğun kapladığı alanı
// sabit `100` ile tahmin ediyordu; üç düğmeli Android gezinmesinde son kart
// çubuğun altında kalabiliyordu.
import { Spacing } from './spacing';

export const TAB_BAR_HEIGHT = 65;
/** Çubuğun sistem gezinme alanının üstünde bıraktığı boşluk. */
export const TAB_BAR_FLOAT_GAP = Spacing.xl;
