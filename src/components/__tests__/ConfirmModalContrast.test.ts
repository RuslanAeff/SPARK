import { resolveTheme, ThemeAccents } from '../../theme/colors';

let mockScheme: 'light' | 'dark' = 'light';
let mockAccent: (typeof ThemeAccents)[number] = 'green';
jest.mock('../../theme/colors', () => {
  const actual = jest.requireActual('../../theme/colors');
  return {
    ...actual,
    Colors: new Proxy({}, { get: (_t, prop: string) => actual.resolveTheme(mockScheme, mockAccent)[prop] }),
  };
});

// eslint-disable-next-line import/first
import { getConfirmButtonColors } from '../ConfirmModal';

function contrast(a: string, b: string): number {
  const lum = (hex: string) => {
    const [r, g, bl] = [1, 3, 5].map(i => parseInt(hex.slice(i, i + 2), 16) / 255)
      .map(c => (c <= 0.03928 ? c / 12.92 : ((c + 0.055) / 1.055) ** 2.4));
    return 0.2126 * r + 0.7152 * g + 0.0722 * bl;
  };
  const [hi, lo] = [lum(a), lum(b)].sort((x, y) => y - x);
  return (hi + 0.05) / (lo + 0.05);
}

describe('ConfirmModal confirm button contrast (DS-03)', () => {
  it.each(['light', 'dark'] as const)('is at least 4.5:1 for every accent and tone in %s theme', scheme => {
    mockScheme = scheme;
    for (const accent of ThemeAccents) {
      mockAccent = accent;
      for (const tone of ['primary', 'warning'] as const) {
        const { background, text } = getConfirmButtonColors(tone);
        expect(contrast(background, text)).toBeGreaterThanOrEqual(4.5);
      }
    }
    expect(resolveTheme(scheme, 'green')).toBeTruthy();
  });
});
