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

export const Typography: Record<string, TextStyle> = {
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
};
