import {
  CategoryColors,
  ChartColorArray,
  Colors,
  ThemeAccents,
  normalizeThemeAccent,
  resolveTheme,
} from '../colors';

function relativeLuminance(hex: string): number {
  const channels = hex
    .slice(1)
    .match(/.{2}/g)!
    .map((channel) => Number.parseInt(channel, 16) / 255)
    .map((channel) =>
      channel <= 0.04045 ? channel / 12.92 : ((channel + 0.055) / 1.055) ** 2.4,
    );
  return channels[0] * 0.2126 + channels[1] * 0.7152 + channels[2] * 0.0722;
}

function contrastRatio(foreground: string, background: string): number {
  const foregroundLum = relativeLuminance(foreground);
  const backgroundLum = relativeLuminance(background);
  return (Math.max(foregroundLum, backgroundLum) + 0.05) /
    (Math.min(foregroundLum, backgroundLum) + 0.05);
}

describe('accent palette contract', () => {
  it('uses vivid display accents in light mode while keeping darker CTA tokens separate', () => {
    expect(ThemeAccents.map((accent) => resolveTheme('light', accent).primary)).toEqual([
      '#00A84F',
      '#007AFF',
      '#E86800',
      '#6D3FC0',
      '#E23645',
    ]);
    expect(resolveTheme('light', 'orange').primaryAction).toBe('#A94700');
    expect(resolveTheme('light', 'red').primaryAction).toBe('#B42335');
  });

  it.each(['light', 'dark'] as const)(
    'provides WCAG AA primary CTA contrast in %s mode for every accent',
    (scheme) => {
      for (const accent of ThemeAccents) {
        const palette = resolveTheme(scheme, accent);
        expect(contrastRatio(palette.onPrimary, palette.primaryAction)).toBeGreaterThanOrEqual(4.5);
      }
    },
  );

  it('falls back to green for invalid persisted values', () => {
    expect(normalizeThemeAccent(undefined)).toBe('green');
    expect(normalizeThemeAccent('rainbow')).toBe('green');
    expect(resolveTheme('light', 'green')).toBe(resolveTheme('light', normalizeThemeAccent('bad')));
  });

  it('reads a different active palette through the legacy Colors proxy without violating proxy invariants', () => {
    const store = require('../themeStore') as typeof import('../themeStore');
    store.setAppThemeSelection({ scheme: 'dark', accent: 'red' });

    expect(Colors.primary).toBe('#FF727B');
    expect(Colors.background).toBe('#050505');
  });

  it.each(['light', 'dark'] as const)(
    'keeps neutral, semantic, category and chart meaning stable in %s mode',
    (scheme) => {
      const baseline = resolveTheme(scheme, 'green');
      const categorySnapshot = { ...CategoryColors };
      const chartSnapshot = [...ChartColorArray];

      for (const accent of ThemeAccents) {
        const palette = resolveTheme(scheme, accent);
        expect({
          background: palette.background,
          surface: palette.surface,
          success: palette.success,
          danger: palette.danger,
          warning: palette.warning,
          info: palette.info,
        }).toEqual({
          background: baseline.background,
          surface: baseline.surface,
          success: baseline.success,
          danger: baseline.danger,
          warning: baseline.warning,
          info: baseline.info,
        });
      }

      expect(CategoryColors).toEqual(categorySnapshot);
      expect(ChartColorArray).toEqual(chartSnapshot);
    },
  );
});
