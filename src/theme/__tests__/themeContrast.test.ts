import { resolveTheme, ThemeAccents, type AppColorScheme } from '../colors';

// UI denetimi DS-02 / DS-08: metin ve ikon olarak kullanılan belirteçlerin
// kendi yüzeylerinde okunabilirlik eşiği (WCAG AA, normal metin 4,5:1).
function contrast(a: string, b: string): number {
  const lum = (hex: string) => {
    const [r, g, bl] = [1, 3, 5].map(i => parseInt(hex.slice(i, i + 2), 16) / 255)
      .map(c => (c <= 0.03928 ? c / 12.92 : ((c + 0.055) / 1.055) ** 2.4));
    return 0.2126 * r + 0.7152 * g + 0.0722 * bl;
  };
  const [hi, lo] = [lum(a), lum(b)].sort((x, y) => y - x);
  return (hi + 0.05) / (lo + 0.05);
}

const surfacesOf = (scheme: AppColorScheme) => {
  const t = resolveTheme(scheme);
  return [t.background, t.surface, t.surfaceLight, t.cardSurface];
};

describe('theme text contrast', () => {
  it('light theme semantic and series colours are readable on light surfaces', () => {
    const t = resolveTheme('light');
    const tokens = ['success', 'danger', 'warning', 'info', 'secondary', 'textMuted', 'tabInactive',
      'chartPurple', 'chartBlue', 'chartOrange', 'chartGreen', 'chartPink', 'chartYellow', 'chartCyan', 'chartRed'] as const;
    for (const token of tokens) {
      for (const surface of surfacesOf('light')) {
        expect({ token, ratio: contrast(t[token], surface) >= 4.3 }).toEqual({ token, ratio: true });
      }
    }
  });

  it('dark muted text and inactive tabs are readable on every dark surface', () => {
    const t = resolveTheme('dark');
    for (const token of ['textMuted', 'tabInactive'] as const) {
      for (const surface of [...surfacesOf('dark'), t.surfaceElevated]) {
        expect(contrast(t[token], surface)).toBeGreaterThanOrEqual(4.5);
      }
    }
  });

  it('on-colour tokens are readable on their semantic fills in both themes', () => {
    for (const scheme of ['light', 'dark'] as const) {
      for (const accent of ThemeAccents) {
        const t = resolveTheme(scheme, accent);
        expect(contrast(t.success, t.onSuccess)).toBeGreaterThanOrEqual(4.5);
        expect(contrast(t.warning, t.onWarning)).toBeGreaterThanOrEqual(4.5);
        expect(contrast(t.primaryAction, t.onPrimary)).toBeGreaterThanOrEqual(4.5);
      }
    }
  });
});
