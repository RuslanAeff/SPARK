import { Appearance } from 'react-native';

export type AppColorScheme = 'light' | 'dark';
export type ThemeAccent = 'green' | 'blue' | 'orange' | 'purple' | 'red';

export const DEFAULT_THEME_ACCENT: ThemeAccent = 'green';
export const ThemeAccents = ['green', 'blue', 'orange', 'purple', 'red'] as const;

export function isThemeAccent(value: unknown): value is ThemeAccent {
  return typeof value === 'string' && (ThemeAccents as readonly string[]).includes(value);
}

export function normalizeThemeAccent(value: unknown): ThemeAccent {
  return isThemeAccent(value) ? value : DEFAULT_THEME_ACCENT;
}

type AccentTokens = {
  /** Ekranda vurgu, ikon ve seçili metin için kullanılan marka rengi. */
  primary: string;
  primaryLight: string;
  primaryDark: string;
  /** Birincil CTA dolgusu; `onPrimary` ile WCAG AA kontrastı sağlar. */
  primaryAction: string;
  onPrimary: string;
  primarySoft: string;
  primaryGlow: string;
  glassBorder: string;
  shadowColor: string;
  tabActive: string;
};

const DarkNeutralTheme = {
  // Opak nötr yüzeyler. Vurgu seçimi bu değerleri değiştirmez.
  background: '#050505',
  surface: '#161618',
  surfaceLight: '#1E1E22',
  surfaceElevated: '#26262C',

  // İkincil marka vurgusu, semantik durum değildir ve paletler arasında sabittir.
  secondary: '#CCFF00',
  secondaryLight: '#D4FF33',
  secondaryDark: '#A3CC00',

  // Semantik renkler vurgu paletinden bağımsızdır.
  success: '#00FF66',
  successDark: '#00CC52',
  danger: '#FF3333',
  dangerDark: '#CC0000',
  warning: '#FFCC00',
  info: '#33CCFF',

  textPrimary: '#FFFFFF',
  textSecondary: '#A0A0B0',
  textMuted: '#666677',
  textInverse: '#000000',

  // Grafik serileri veri anlamını korumak için vurgu seçiminden bağımsızdır.
  chartPurple: '#9D00FF',
  chartBlue: '#00FFFF',
  chartOrange: '#FF6600',
  chartGreen: '#00FF66',
  chartPink: '#FF00AA',
  chartYellow: '#CCFF00',
  chartCyan: '#00CCFF',
  chartRed: '#FF3333',

  border: '#2A2A2A',
  borderLight: '#3D3D3D',
  divider: 'rgba(255, 255, 255, 0.08)',
  cardBorder: '#505060',
  cardSurface: '#1C1C1E',
  inputBackground: '#252528',
  inputBorder: '#3D3D3D',

  glass: 'rgba(10, 10, 10, 0.90)',

  tabInactive: '#666677',
  tabBackground: '#050505',
} as const;

const LightNeutralTheme = {
  ...DarkNeutralTheme,
  background: '#F5F5F7',
  surface: '#FFFFFF',
  surfaceLight: '#F0F0F3',
  surfaceElevated: '#FFFFFF',

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

  tabInactive: '#9999AA',
  tabBackground: '#FFFFFF',
} as const;

type AccentDefinition = Record<AppColorScheme, AccentTokens>;

/**
 * Her vurgu ailesi yalnız marka/etkileşim tokenlarını değiştirir. Kırmızı vurgu,
 * silme ve hata için ayrılan daha parlak `danger` renginden özellikle ayrıdır.
 */
export const AccentPalettes: Record<ThemeAccent, AccentDefinition> = {
  green: {
    light: {
      primary: '#00A84F',
      primaryLight: '#32D583',
      primaryDark: '#006B35',
      primaryAction: '#007A3D',
      onPrimary: '#FFFFFF',
      primarySoft: 'rgba(0, 168, 79, 0.11)',
      primaryGlow: 'rgba(0, 168, 79, 0.14)',
      glassBorder: 'rgba(0, 168, 79, 0.28)',
      shadowColor: '#00A84F',
      tabActive: '#00A84F',
    },
    dark: {
      primary: '#2EE88C',
      primaryLight: '#62F2AA',
      primaryDark: '#00A85A',
      primaryAction: '#007A3D',
      onPrimary: '#FFFFFF',
      primarySoft: 'rgba(46, 232, 140, 0.13)',
      primaryGlow: 'rgba(46, 232, 140, 0.16)',
      glassBorder: 'rgba(46, 232, 140, 0.30)',
      shadowColor: '#2EE88C',
      tabActive: '#2EE88C',
    },
  },
  blue: {
    light: {
      primary: '#007AFF',
      primaryLight: '#57A8FF',
      primaryDark: '#0057A3',
      primaryAction: '#0067C0',
      onPrimary: '#FFFFFF',
      primarySoft: 'rgba(0, 122, 255, 0.10)',
      primaryGlow: 'rgba(0, 122, 255, 0.14)',
      glassBorder: 'rgba(0, 122, 255, 0.28)',
      shadowColor: '#007AFF',
      tabActive: '#007AFF',
    },
    dark: {
      primary: '#5AC8FA',
      primaryLight: '#8DD9FC',
      primaryDark: '#168CC8',
      primaryAction: '#0067C0',
      onPrimary: '#FFFFFF',
      primarySoft: 'rgba(90, 200, 250, 0.13)',
      primaryGlow: 'rgba(90, 200, 250, 0.16)',
      glassBorder: 'rgba(90, 200, 250, 0.30)',
      shadowColor: '#5AC8FA',
      tabActive: '#5AC8FA',
    },
  },
  orange: {
    light: {
      primary: '#E86800',
      primaryLight: '#FF9A3C',
      primaryDark: '#8E3C00',
      primaryAction: '#A94700',
      onPrimary: '#FFFFFF',
      primarySoft: 'rgba(232, 104, 0, 0.10)',
      primaryGlow: 'rgba(232, 104, 0, 0.14)',
      glassBorder: 'rgba(232, 104, 0, 0.28)',
      shadowColor: '#E86800',
      tabActive: '#E86800',
    },
    dark: {
      primary: '#FFB04A',
      primaryLight: '#FFC879',
      primaryDark: '#D97818',
      primaryAction: '#A94700',
      onPrimary: '#FFFFFF',
      primarySoft: 'rgba(255, 176, 74, 0.13)',
      primaryGlow: 'rgba(255, 176, 74, 0.16)',
      glassBorder: 'rgba(255, 176, 74, 0.30)',
      shadowColor: '#FFB04A',
      tabActive: '#FFB04A',
    },
  },
  purple: {
    light: {
      primary: '#6D3FC0',
      primaryLight: '#A078E4',
      primaryDark: '#5931A2',
      primaryAction: '#6D3FC0',
      onPrimary: '#FFFFFF',
      primarySoft: 'rgba(109, 63, 192, 0.10)',
      primaryGlow: 'rgba(109, 63, 192, 0.12)',
      glassBorder: 'rgba(109, 63, 192, 0.24)',
      shadowColor: '#6D3FC0',
      tabActive: '#6D3FC0',
    },
    dark: {
      primary: '#C39BFF',
      primaryLight: '#D8BDFF',
      primaryDark: '#8A5BD0',
      primaryAction: '#6D3FC0',
      onPrimary: '#FFFFFF',
      primarySoft: 'rgba(195, 155, 255, 0.13)',
      primaryGlow: 'rgba(195, 155, 255, 0.16)',
      glassBorder: 'rgba(195, 155, 255, 0.30)',
      shadowColor: '#C39BFF',
      tabActive: '#C39BFF',
    },
  },
  red: {
    light: {
      primary: '#E23645',
      primaryLight: '#FF6877',
      primaryDark: '#971D2C',
      primaryAction: '#B42335',
      onPrimary: '#FFFFFF',
      primarySoft: 'rgba(226, 54, 69, 0.10)',
      primaryGlow: 'rgba(226, 54, 69, 0.14)',
      glassBorder: 'rgba(226, 54, 69, 0.28)',
      shadowColor: '#E23645',
      tabActive: '#E23645',
    },
    dark: {
      primary: '#FF727B',
      primaryLight: '#FF9BA1',
      primaryDark: '#D74655',
      primaryAction: '#B42335',
      onPrimary: '#FFFFFF',
      primarySoft: 'rgba(255, 114, 123, 0.13)',
      primaryGlow: 'rgba(255, 114, 123, 0.16)',
      glassBorder: 'rgba(255, 114, 123, 0.30)',
      shadowColor: '#FF727B',
      tabActive: '#FF727B',
    },
  },
};

type NeutralTokens = { [K in keyof typeof DarkNeutralTheme]: string };
export type ThemePalette = NeutralTokens & AccentTokens;

const resolvedThemes = Object.fromEntries(
  (['light', 'dark'] as const).flatMap((scheme) =>
    ThemeAccents.map((accent) => {
      const neutral = scheme === 'light' ? LightNeutralTheme : DarkNeutralTheme;
      return [`${scheme}:${accent}`, Object.freeze({ ...neutral, ...AccentPalettes[accent][scheme] })];
    }),
  ),
) as Record<`${AppColorScheme}:${ThemeAccent}`, ThemePalette>;

/** Nötr tema ile seçili vurgu ailesini tek, kararlı palet nesnesinde birleştirir. */
export function resolveTheme(
  scheme: AppColorScheme,
  accent: ThemeAccent = DEFAULT_THEME_ACCENT,
): ThemePalette {
  return resolvedThemes[`${scheme}:${normalizeThemeAccent(accent)}`];
}

// Geriye dönük API: vurgu seçmeyen kod yeşil SPARK temasını kullanmaya devam eder.
export const DarkTheme = resolveTheme('dark', DEFAULT_THEME_ACCENT);
export const LightTheme = resolveTheme('light', DEFAULT_THEME_ACCENT);

/** Belirsiz native modda aydınlık varsayılır. */
export function getEffectiveColorScheme(): AppColorScheme {
  return Appearance.getColorScheme() === 'dark' ? 'dark' : 'light';
}

type ThemeSelectionReader = () => { scheme: AppColorScheme; accent: ThemeAccent };
let themeSelectionReader: ThemeSelectionReader | null = null;

/** Tema mağazası yüklenince aktif snapshot okuyucusunu döngüsüz biçimde bağlar. */
export function setThemeSelectionReader(reader: ThemeSelectionReader): void {
  themeSelectionReader = reader;
}

function readActiveTheme(): { scheme: AppColorScheme; accent: ThemeAccent } {
  return themeSelectionReader?.() ?? {
    scheme: getEffectiveColorScheme(),
    accent: DEFAULT_THEME_ACCENT,
  };
}

/**
 * StyleSheet fabrikalarının mevcut `Colors.*` API'si scheme + accent atomik
 * snapshot'ından çözülür. Vurgu değişiminde `useAppTheme()` aboneleri yeniden
 * render edildiği için proxy her render'da yeni paleti görür.
 */
// Proxy hedefi bilerek boş ve extensible tutulur. Dondurulmuş `DarkTheme`
// hedefi kullanılırsa farklı accent değeri döndürmek ECMAScript proxy
// invariant'ını ihlal eder ve runtime'da TypeError üretir.
export const Colors = new Proxy({} as ThemePalette, {
  get(_target, prop: keyof ThemePalette) {
    const { scheme, accent } = readActiveTheme();
    return resolveTheme(scheme, accent)[prop];
  },
});

// Kategori ve grafik renkleri kullanıcı vurgusundan bağımsız, veri anlamı sabit paletlerdir.
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
