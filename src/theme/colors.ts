import { Appearance } from 'react-native';

export const DarkTheme = {
  // Backgrounds (opak yüzeyler — şeffaf rgba kartlarda/alt panelde soluk “cam” ve düşük kontrast veriyordu)
  background: '#050505',
  surface: '#161618',
  surfaceLight: '#1E1E22',
  surfaceElevated: '#26262C',
  
  // Primary — aydınlık temadaki yeşile yakın; neon #00FF66 üstünde beyaz yazı/ikon kontrastı zayıftı
  primary: '#00C853',
  primaryLight: '#2EE88C',
  primaryDark: '#00A344',
  primaryGlow: 'rgba(0, 200, 83, 0.14)',
  
  // Secondary Accents (Lime / Neon green accents)
  secondary: '#CCFF00',
  secondaryLight: '#D4FF33',
  secondaryDark: '#A3CC00',
  
  // Semantic
  success: '#00FF66',
  successDark: '#00CC52',
  danger: '#FF3333',
  dangerDark: '#CC0000',
  warning: '#FFCC00',
  info: '#33CCFF',
  
  // Text
  textPrimary: '#FFFFFF',
  textSecondary: '#A0A0B0',
  textMuted: '#666677',
  textInverse: '#000000',
  
  // Chart Colors
  chartPurple: '#9D00FF',
  chartBlue: '#00FFFF',
  chartOrange: '#FF6600',
  chartGreen: '#00FF66',
  chartPink: '#FF00AA',
  chartYellow: '#CCFF00',
  chartCyan: '#00CCFF',
  chartRed: '#FF3333',
  
  // Borders & Dividers
  border: '#2A2A2A',
  borderLight: '#3D3D3D',
  divider: 'rgba(255, 255, 255, 0.08)',
  cardBorder: '#505060',
  cardSurface: '#1C1C1E',
  inputBackground: '#252528',
  inputBorder: '#3D3D3D',
  
  // Glassmorphism
  glass: 'rgba(10, 10, 10, 0.90)',
  glassBorder: 'rgba(0, 200, 83, 0.35)',
  
  // Shadows
  shadowColor: '#00C853',
  
  // Bottom Tab
  tabActive: '#00C853',
  tabInactive: '#666677',
  tabBackground: '#050505',
};

export const LightTheme = {
  ...DarkTheme, // Inherit base shapes
  background: '#F5F5F7',
  surface: '#FFFFFF',
  surfaceLight: '#F0F0F3',
  surfaceElevated: '#FFFFFF',
  
  primary: '#00B347',
  primaryLight: '#33FF85',
  primaryDark: '#00993D',
  primaryGlow: 'rgba(0, 179, 71, 0.08)',
  
  textPrimary: '#1A1A1A',
  textSecondary: '#666677',
  textMuted: '#6E6E80',
  textInverse: '#FFFFFF',
  
  border: '#E5E5EA',
  borderLight: '#D1D1D6',
  divider: 'rgba(0, 0, 0, 0.08)',
  cardBorder: '#D1D1D6',
  cardSurface: '#FFFFFF',
  inputBackground: '#F0F0F3',
  inputBorder: '#D1D1D6',
  
  glass: 'rgba(255, 255, 255, 0.90)',
  glassBorder: 'rgba(0, 0, 0, 0.05)',
  
  shadowColor: '#000000',
  
  tabActive: '#00B347',
  tabInactive: '#9999AA',
  tabBackground: '#FFFFFF',
};

/**
 * Tek doğruluk kaynağı: her zaman güncel Appearance okunur.
 * Eski _cachedScheme + listener, useColorScheme() ile senkron kaybolabiliyordu →
 * shell açık (light) iken kartlar koyu (dark) kalıyordu.
 * null/undefined: aydınlık varsayılır (RN’de belirsiz modda koyu karta düşmeyi engeller).
 */
export function getEffectiveColorScheme(): 'light' | 'dark' {
  const cs = Appearance.getColorScheme();
  if (cs === 'dark') return 'dark';
  return 'light';
}

export const Colors = new Proxy(DarkTheme, {
  get(_target, prop: keyof typeof DarkTheme) {
    return getEffectiveColorScheme() === 'light' ? LightTheme[prop] : DarkTheme[prop];
  },
});

// Category-specific colors
export const CategoryColors: Record<string, string> = {
  'Yeme-İçme': '#00FF66',
  'Ulaşım': '#00CCFF',
  'Alışveriş': '#FF00AA',
  'Eğlence': '#9D00FF',
  'Faturalar': '#FFCC00',
  'Konut': '#8B7FC8',
  'Ev Kirası': '#7B6FB8',
  'Aidat': '#7366AE',
  'Konut Kredisi': '#6B5DA4',
  'Sağlık': '#33FF85',
  'Medikal Ürün & Cihaz': '#1B9650',
  'Eğitim': '#00FFFF',
  'Diğer': '#A0A0B0',
};

export const ChartColorArray = [
  '#00FF66', '#00CCFF', '#FF00AA', '#CCFF00',
  '#9D00FF', '#33FF85', '#FFCC00', '#00FFFF',
  '#FF3333', '#A0A0B0',
];
