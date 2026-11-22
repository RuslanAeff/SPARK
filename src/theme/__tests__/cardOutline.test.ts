// Kart kenarı (`cardOutline`): vurgu tonunda, düşük doygunlukta ve eski nötr
// kenarla aynı parlaklık farkında olmalı (ürün sahibi kararı, 22 Kasım 2026).
import { ThemeAccents, resolveTheme, type AppColorScheme } from '../colors';

function rgb(hex: string): [number, number, number] {
  const h = hex.replace('#', '');
  return [0, 2, 4].map(i => parseInt(h.slice(i, i + 2), 16) / 255) as [number, number, number];
}

function luminance(hex: string): number {
  const [r, g, b] = rgb(hex).map(c => (c <= 0.03928 ? c / 12.92 : ((c + 0.055) / 1.055) ** 2.4));
  return 0.2126 * r + 0.7152 * g + 0.0722 * b;
}

function contrast(a: string, b: string): number {
  const [hi, lo] = [luminance(a), luminance(b)].sort((x, y) => y - x);
  return (hi + 0.05) / (lo + 0.05);
}

function hueAndSaturation(hex: string): { hue: number; saturation: number } {
  const [r, g, b] = rgb(hex);
  const max = Math.max(r, g, b);
  const min = Math.min(r, g, b);
  const lightness = (max + min) / 2;
  const delta = max - min;
  if (delta === 0) return { hue: 0, saturation: 0 };
  const saturation = delta / (1 - Math.abs(2 * lightness - 1));
  let hue = max === r ? ((g - b) / delta) % 6 : max === g ? (b - r) / delta + 2 : (r - g) / delta + 4;
  hue = (hue * 60 + 360) % 360;
  return { hue, saturation };
}

const hueDistance = (a: number, b: number) => Math.min(Math.abs(a - b), 360 - Math.abs(a - b));

describe.each(['dark', 'light'] as AppColorScheme[])('%s card outline', scheme => {
  it.each([...ThemeAccents])('%s: accent hue, muted, same contrast as the neutral border', accent => {
    const theme = resolveTheme(scheme, accent);
    expect(contrast(theme.cardOutline, theme.cardSurface))
      .toBeCloseTo(contrast(theme.cardBorder, theme.cardSurface), 1);
    const outline = hueAndSaturation(theme.cardOutline);
    expect(outline.saturation).toBeLessThanOrEqual(0.25);
    expect(hueDistance(outline.hue, hueAndSaturation(theme.primary).hue)).toBeLessThan(8);
  });
});
