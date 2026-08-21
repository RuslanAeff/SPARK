import { DarkTheme, LightTheme, resolveTheme } from '../colors';
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

  it('maps a resolved accent palette while keeping semantic notification color', () => {
    const palette = resolveTheme('dark', 'purple');
    const theme = createNavigationTheme('dark', palette);

    expect(theme.colors.primary).toBe(palette.primary);
    expect(theme.colors.background).toBe(palette.background);
    expect(theme.colors.notification).toBe(palette.danger);
  });

  it('accepts an accent name as a backward-compatible optional argument', () => {
    expect(createNavigationTheme('light', 'red').colors.primary).toBe(
      resolveTheme('light', 'red').primary,
    );
  });
});
