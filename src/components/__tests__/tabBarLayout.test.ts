// Alt sekme çubuğu geometrisi: gerçek ekran genişlikleri ve Inter Medium 10 px
// ile font dosyasından ölçülen en uzun etiketler (dp).
import { TAB_BAR_HEIGHT } from '../../theme/layout';
import {
  BAR_RADIUS,
  MIN_LABEL_SCALE,
  SELECTOR_INSET,
  SELECTOR_RADIUS,
  SELECTOR_HEIGHT,
  computeTabBarGeometry,
  tabBarSideMargin,
  selectorBarClearance,
  selectorOffset,
} from '../tabBarLayout';

const LONGEST = { TR: 52.2, EN: 62.3, AZ: 59.9, RU: 53.5 };
// Çubuk genişliği = ekran − 2 × yan boşluk (uygulamadaki fonksiyonun aynısı).
const bar = (screen: number) => screen - 2 * tabBarSideMargin(screen);
const scale = (screen: number, width: number) => computeTabBarGeometry(bar(screen), 5, [width]).labelScale;

describe('rounded selector geometry', () => {
  it('uses concentric corners: bar radius = selector radius + inset', () => {
    expect(SELECTOR_INSET).toBe((TAB_BAR_HEIGHT - SELECTOR_HEIGHT) / 2);
    expect(BAR_RADIUS).toBe(SELECTOR_RADIUS + SELECTOR_INSET);
    expect(BAR_RADIUS).toBeLessThan(TAB_BAR_HEIGHT / 2);
  });

  it.each([360, 393, 412, 430])('sits in the end cell with an even inset on a %i dp phone', screen => {
    const g = computeTabBarGeometry(bar(screen), 5, []);
    expect(selectorOffset(0, g)).toBeCloseTo(SELECTOR_INSET, 5);
    expect(selectorBarClearance(bar(screen), TAB_BAR_HEIGHT, g)).toBeCloseTo(SELECTOR_INSET, 1);
  });

  it('never overlaps the neighbouring cell', () => {
    const g = computeTabBarGeometry(bar(393), 5, []);
    expect(selectorOffset(1, g) - (selectorOffset(0, g) + g.selectorWidth)).toBeGreaterThan(0);
  });

  it.each([393, 412, 430])('fits every language at full size inside the selector on a %i dp phone', screen => {
    for (const width of Object.values(LONGEST)) expect(scale(screen, width)).toBe(1);
  });

  it('on a 360 dp phone TR/RU stay full size; AZ ~98%, EN ~94%', () => {
    expect(scale(360, LONGEST.TR)).toBe(1);
    expect(scale(360, LONGEST.RU)).toBe(1);
    expect(scale(360, LONGEST.AZ)).toBeGreaterThan(0.97);
    expect(scale(360, LONGEST.EN)).toBeGreaterThan(0.93);
    expect(scale(360, LONGEST.EN)).toBeGreaterThanOrEqual(MIN_LABEL_SCALE);
  });

  it('treats unmeasured labels as full size', () => {
    expect(computeTabBarGeometry(352, 5, []).labelScale).toBe(1);
  });
});

describe('tabBarSideMargin', () => {
  it('keeps the bar wider than the 20 dp-inset content cards on every phone', () => {
    for (const screen of [320, 360, 393, 412, 430]) {
      expect(tabBarSideMargin(screen)).toBeLessThan(20);
    }
    expect(tabBarSideMargin(393)).toBe(12);
    expect(tabBarSideMargin(360)).toBe(8);
  });
});
