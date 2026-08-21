import {
  DarkTheme as ReactNavigationDarkTheme,
  DefaultTheme as ReactNavigationLightTheme,
  type Theme as ReactNavigationTheme,
} from '@react-navigation/native';

import {
  DEFAULT_THEME_ACCENT,
  resolveTheme,
  type AppColorScheme,
  type ThemeAccent,
  type ThemePalette,
} from './colors';

export type { AppColorScheme } from './colors';

/**
 * React Navigation kendi varsayılan açık temasını nested navigator yüzeylerine
 * uygular. SPARK paletini bu context'e açıkça aktarmak; pager, lazy scene ve
 * stack geçişlerinin uygulama kabuğuyla aynı opak rengi kullanmasını sağlar.
 */
export function createNavigationTheme(
  scheme: AppColorScheme,
  accentOrPalette: ThemeAccent | ThemePalette = DEFAULT_THEME_ACCENT,
): ReactNavigationTheme {
  const palette =
    typeof accentOrPalette === 'string'
      ? resolveTheme(scheme, accentOrPalette)
      : accentOrPalette;
  const base = scheme === 'light' ? ReactNavigationLightTheme : ReactNavigationDarkTheme;

  return {
    ...base,
    dark: scheme === 'dark',
    colors: {
      ...base.colors,
      primary: palette.primary,
      background: palette.background,
      card: palette.surface,
      text: palette.textPrimary,
      border: palette.border,
      notification: palette.danger,
    },
  };
}
