/**
 * Şüşevar (kod adı: `susevar`)
 * ---------------------------
 * SPARK uygulamasının **birincil kayıt / onay** düğmesi görsel kimliği.
 * “KAYDET”, fiş tarama “Kaydet”, hedef ayarları kaydı vb. aynı ailededir.
 *
 * Başka ekranlarda aynı dili kullanmak için aktif paletle
 * `createSusevarStyles(palette)` çağırın. Kullanıcı veya ekip “şüşevar tarzı”
 * dediğinde bu runtime tema sözleşmesi kastedilir.
 */

import { Platform, TextStyle, ViewStyle } from 'react-native';

import { BorderRadius, Spacing } from './spacing';
import { FontFamily } from './typography';

type SusevarPalette = {
  primaryAction: string;
  onPrimary: string;
};

/**
 * Runtime tema paletinden şüşevar stillerini üretir. Modül seviyesinde
 * `Colors.primary` okumak vurgu rengini ilk import anında dondurduğu için ana
 * CTA gövdesi ve etiketi bu factory üzerinden oluşturulmalıdır.
 */
export function createSusevarStyles(palette: SusevarPalette): {
  button: ViewStyle;
  text: TextStyle;
} {
  const shadow = Platform.select({
    ios: {
      shadowColor: palette.primaryAction,
      shadowOffset: { width: 0, height: 6 },
      shadowOpacity: 0.4,
      shadowRadius: 14,
    },
    android: {
      elevation: 10,
      shadowColor: palette.primaryAction,
    },
  });

  return {
    button: {
      backgroundColor: palette.primaryAction,
      borderRadius: BorderRadius.round,
      paddingVertical: Spacing.lg,
      paddingHorizontal: Spacing.xxl,
      alignItems: 'center',
      justifyContent: 'center',
      borderWidth: 1,
      borderColor: 'rgba(255,255,255,0.35)',
      ...shadow,
    },
    text: {
      color: palette.onPrimary,
      fontFamily: FontFamily.extraBold,
      fontSize: 17,
      letterSpacing: 0.8,
      textTransform: 'uppercase',
    },
  };
}

/** Şüşevar — basılı durum. */
export const susevarButtonPressed: ViewStyle = {
  opacity: 0.9,
};

/** Form sonunda ana kayıt düğmesi için üst boşluk (ör. yeni harcama KAYDET). */
export const susevarButtonMarginTop: ViewStyle = {
  marginTop: Spacing.xl,
};

/** İkon + metin şüşevar (ör. tarayıcı Kaydet + check ikonu). */
export const susevarButtonRow: ViewStyle = {
  flexDirection: 'row',
  alignItems: 'center',
  justifyContent: 'center',
  gap: Spacing.sm,
};
