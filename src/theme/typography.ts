// S.P.A.R.K. — Typography Scale
import { TextStyle } from 'react-native';

export const FontFamily = {
  regular: 'Inter_400Regular',
  medium: 'Inter_500Medium',
  semiBold: 'Inter_600SemiBold',
  bold: 'Inter_700Bold',
  extraBold: 'Inter_800ExtraBold',
  /** Kart / bölüm başlıkları — Inter 800 (900 ayrı yükleme Android’de CodedError verebildiği için aynı aile) */
  black: 'Inter_800ExtraBold',
};

/**
 * Yazı boyutu basamakları (UI denetimi DS-09). Ekranlar `fontSize` için ham
 * sayı yazmaz; ya bir `Typography` stilini ya da buradaki bir basamağı
 * kullanır. Böylece "tüm başlıkları 1 px büyüt" gibi bir karar tek yerden
 * uygulanır. Değerler, taşıma anında ekranlarda kullanılan boyutların
 * birebir aynısıdır (görünüm değişmedi).
 */
export const FontSize = {
  xxs: 10,
  xs: 11,
  sm: 12,
  md: 13,
  base: 14,
  lg: 15,
  xl: 16,
  xxl: 17,
  h3: 18,
  h2: 20,
  h1: 22,
  display: 24,
  displayLg: 26,
  hero: 30,
  heroLg: 32,
  /** Tutar girişindeki büyük rakam. */
  amountInput: 48,
} as const;

// `satisfies`: anahtarlar sabit tiptir; var olmayan `Typography.x` derlemede hata verir
// (UI denetimi DS-05: `titleSmall`/`titleMedium` sessizce boş stil üretiyordu).
export const Typography = {
  // Display
  displayLarge: {
    fontFamily: FontFamily.bold,
    fontSize: 42,
    lineHeight: 50,
    letterSpacing: -1.5,
  },
  displayMedium: {
    fontFamily: FontFamily.bold,
    fontSize: 34,
    lineHeight: 42,
    letterSpacing: -0.5,
  },
  displaySmall: {
    fontFamily: FontFamily.semiBold,
    fontSize: 28,
    lineHeight: 36,
    letterSpacing: 0,
  },
  
  // Headline
  headlineLarge: {
    fontFamily: FontFamily.semiBold,
    fontSize: 24,
    lineHeight: 32,
    letterSpacing: 0,
  },
  headlineMedium: {
    fontFamily: FontFamily.semiBold,
    fontSize: 20,
    lineHeight: 28,
    letterSpacing: 0.15,
  },
  headlineSmall: {
    fontFamily: FontFamily.medium,
    fontSize: 18,
    lineHeight: 26,
    letterSpacing: 0.15,
  },
  
  // Body
  bodyLarge: {
    fontFamily: FontFamily.regular,
    fontSize: 16,
    lineHeight: 24,
    letterSpacing: 0.5,
  },
  bodyMedium: {
    fontFamily: FontFamily.regular,
    fontSize: 14,
    lineHeight: 20,
    letterSpacing: 0.25,
  },
  bodySmall: {
    fontFamily: FontFamily.regular,
    fontSize: 12,
    lineHeight: 16,
    letterSpacing: 0.4,
  },
  
  // Label
  labelLarge: {
    fontFamily: FontFamily.medium,
    fontSize: 14,
    lineHeight: 20,
    letterSpacing: 0.1,
  },
  labelMedium: {
    fontFamily: FontFamily.medium,
    fontSize: 12,
    lineHeight: 16,
    letterSpacing: 0.5,
  },
  labelSmall: {
    fontFamily: FontFamily.medium,
    fontSize: 11,
    lineHeight: 14,
    letterSpacing: 0.5,
  },
  /**
   * Ölçeğin en küçük basamağı (UI denetimi DS-09): rozet, eksen ve sekme
   * etiketi. Bunun altında yazı kullanılmaz.
   */
  labelTiny: {
    fontFamily: FontFamily.medium,
    fontSize: 10,
    lineHeight: 14,
    letterSpacing: 0.4,
  },

  // Amount (special for currency)
  amount: {
    fontFamily: FontFamily.bold,
    fontSize: 32,
    lineHeight: 40,
    letterSpacing: -0.5,
  },
  amountSmall: {
    fontFamily: FontFamily.semiBold,
    fontSize: 18,
    lineHeight: 24,
    letterSpacing: 0,
  },
} satisfies Record<string, TextStyle>;
