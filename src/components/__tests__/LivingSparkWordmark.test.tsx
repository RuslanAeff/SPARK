import React from 'react';
import { fireEvent, render } from '@testing-library/react-native';

import LivingSparkWordmark, {
  resolveWordmarkLayout,
  resolveWordmarkMotionProfile,
} from '../LivingSparkWordmark';

const mockWithRepeat = jest.fn((value: unknown) => value);
const mockWithTiming = jest.fn((value: unknown, _config?: unknown) => value);
const mockUseReducedMotion = jest.fn(() => false);

jest.mock('react-native-reanimated', () => ({
  __esModule: true,
  default: { createAnimatedComponent: (Component: unknown) => Component },
  cancelAnimation: jest.fn(),
  useAnimatedProps: (factory: () => unknown) => factory(),
  useReducedMotion: () => mockUseReducedMotion(),
  useSharedValue: (value: number) => require('react').useRef({ value }).current,
  withRepeat: (value: unknown) => mockWithRepeat(value),
  withTiming: (value: unknown, config?: unknown) => mockWithTiming(value, config),
  Easing: { linear: (value: number) => value },
}));

jest.mock('../../theme/themeStore', () => ({
  useAppThemeSnapshot: () => ({
    scheme: 'dark',
    accent: 'blue',
    revision: 1,
    palette: {
      primary: '#5AC8FA',
      primaryLight: '#8DD9FC',
      primaryDark: '#168CC8',
    },
  }),
}));

describe('LivingSparkWordmark', () => {
  beforeEach(() => {
    mockWithRepeat.mockClear();
    mockWithTiming.mockClear();
    mockUseReducedMotion.mockReturnValue(false);
  });

  it('yaşayan imzayı tek ve açıklayıcı erişilebilir öğe olarak sunar', async () => {
    const screen = await render(
      <LivingSparkWordmark
        testID="spark-signature"
        accessibilityHint="Dokunarak animasyonu uyandır"
      />,
    );

    expect(screen.getByTestId('spark-signature')).toHaveProp('accessibilityLabel', 'S.P.A.R.K');
    expect(screen.getByTestId('spark-signature')).toHaveProp('accessibilityRole', 'button');
    expect(screen.getByTestId('spark-signature')).toHaveProp(
      'accessibilityHint',
      'Dokunarak animasyonu uyandır',
    );
    expect(screen.getByTestId('spark-signature-energy')).toBeTruthy();
    expect(screen.getByTestId('spark-signature-core')).toBeTruthy();
    expect(screen.getByTestId('spark-signature-center-wave')).toBeTruthy();
    expect(screen.getByTestId('spark-signature-center-wave-secondary')).toBeTruthy();
    expect(screen.getByTestId('spark-signature-mist-secondary')).toBeTruthy();
    expect(screen.getByTestId('spark-signature-energy-secondary')).toBeTruthy();
    expect(screen.getByTestId('spark-signature-reaction-core')).toBeTruthy();
    expect(screen.getByTestId('spark-signature-reaction-wave')).toBeTruthy();
    expect(screen.getByTestId('spark-signature-reaction-wave-secondary')).toBeTruthy();
    expect(mockWithRepeat).toHaveBeenCalledTimes(3);
    expect(
      mockWithTiming.mock.calls.map(([, config]) => (config as { duration?: number })?.duration),
    ).toEqual([6200, 3800, 5400]);
  });

  it('tok harfleri sıkı eşit aralıkta, ilk iki noktayı optik olarak sola yerleştirir', async () => {
    const screen = await render(<LivingSparkWordmark testID="spaced-signature" />);
    const heroLayout = resolveWordmarkLayout('hero');
    const letterCenters = [11, 41, 71, 101, 131];
    const dotCenters = [25, 54, 86, 116];

    letterCenters.forEach((x, index) => {
      expect(screen.getByTestId(`spaced-signature-letter-${index}`)).toHaveProp('x', [x]);
    });
    expect(heroLayout.fontSize).toBe(32);
    expect(heroLayout.strokeWidth).toBe(1.2);
    dotCenters.forEach((cx, index) => {
      expect(screen.getByTestId(`spaced-signature-dot-${index}`)).toHaveProp('cx', cx);
    });
    expect(dotCenters[0]).toBeLessThan((letterCenters[0] + letterCenters[1]) / 2);
    expect(dotCenters[1]).toBeLessThan((letterCenters[1] + letterCenters[2]) / 2);
    expect(dotCenters[2]).toBe((letterCenters[2] + letterCenters[3]) / 2);
    expect(dotCenters[3]).toBe((letterCenters[3] + letterCenters[4]) / 2);
    expect(screen.getByTestId('spaced-signature')).toHaveStyle({ width: 144 });
  });

  it('imzanın herhangi bir yerine dokunulduğunda anlık merkez tepkisini yeniden başlatır', async () => {
    const screen = await render(<LivingSparkWordmark testID="reactive-signature" />);
    const ambientTimingCalls = mockWithTiming.mock.calls.length;

    fireEvent.press(screen.getByTestId('reactive-signature'));

    expect(mockWithTiming.mock.calls.length).toBe(ambientTimingCalls + 1);
    expect(mockWithTiming).toHaveBeenLastCalledWith(
      1,
      expect.objectContaining({ duration: 980 }),
    );
  });

  it('aydınlık temada uç tonu eşitler ve yaşayan çekirdekleri uçlara taşır', () => {
    const colors = { primary: '#5AC8FA', primaryDark: '#168CC8' };
    const light = resolveWordmarkMotionProfile('light', colors, 144);
    const dark = resolveWordmarkMotionProfile('dark', colors, 144);

    expect(light.baseEdgeColor).toBe(colors.primary);
    expect(dark.baseEdgeColor).toBe(colors.primaryDark);
    expect(light.mistPrimaryTravel).toBeGreaterThan(dark.mistPrimaryTravel);
    expect(light.mistSecondaryTravel).toBeGreaterThan(dark.mistSecondaryTravel);
    expect(light.ambientOpacityMultiplier).toBeGreaterThan(dark.ambientOpacityMultiplier);
  });

  it('klasik geri dönüş varyantında hareket katmanlarını oluşturmaz', async () => {
    const screen = await render(
      <LivingSparkWordmark variant="classic" size="compact" testID="classic-signature" />,
    );

    expect(screen.getByText('S.P.A.R.K')).toBeTruthy();
    expect(screen.queryByTestId('classic-signature-energy')).toBeNull();
    expect(screen.queryByTestId('classic-signature-core')).toBeNull();
    expect(mockWithRepeat).not.toHaveBeenCalled();
  });

  it('ekran odağı yokken sürekli hareket başlatmaz', async () => {
    await render(<LivingSparkWordmark active={false} />);
    expect(mockWithRepeat).not.toHaveBeenCalled();
  });

  it('sistem hareket azaltma tercihini statik görünümle karşılar', async () => {
    mockUseReducedMotion.mockReturnValue(true);
    const screen = await render(<LivingSparkWordmark testID="reduced-motion-signature" />);

    expect(screen.getByTestId('reduced-motion-signature-energy')).toBeTruthy();
    expect(screen.getByTestId('reduced-motion-signature-core')).toBeTruthy();
    expect(screen.getByTestId('reduced-motion-signature')).toHaveProp('accessibilityRole', 'image');
    expect(mockWithRepeat).not.toHaveBeenCalled();

    fireEvent.press(screen.getByTestId('reduced-motion-signature'));
    expect(mockWithTiming).not.toHaveBeenCalled();
  });
});
