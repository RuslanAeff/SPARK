import {
  DarkTheme as ReactNavigationDarkTheme,
  DefaultTheme as ReactNavigationLightTheme,
  type Theme as ReactNavigationTheme,
} from '@react-navigation/native';

import { DarkTheme, LightTheme } from './colors';

export type AppColorScheme = 'light' | 'dark';

/**
 * React Navigation kendi varsayılan açık temasını nested navigator yüzeylerine
 * uygular. SPARK paletini bu context'e açıkça aktarmak; pager, lazy scene ve
 * stack geçişlerinin uygulama kabuğuyla aynı opak rengi kullanmasını sağlar.
 */
export function createNavigationTheme(scheme: AppColorScheme): ReactNavigationTheme {
  const palette = scheme === 'light' ? LightTheme : DarkTheme;
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
