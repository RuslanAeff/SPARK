import { DarkTheme, LightTheme } from '../colors';
import { createNavigationTheme } from '../navigationTheme';

describe('React Navigation theme bridge', () => {
  it.each([
    ['dark', DarkTheme],
    ['light', LightTheme],
  ] as const)('maps the %s SPARK palette onto every navigator surface', (scheme, palette) => {
    const theme = createNavigationTheme(scheme);

    expect(theme.dark).toBe(scheme === 'dark');
    expect(theme.colors).toMatchObject({
      primary: palette.primary,
      background: palette.background,
      card: palette.surface,
      text: palette.textPrimary,
      border: palette.border,
      notification: palette.danger,
    });
  });
});
