import React from 'react';
import { fireEvent, render } from '@testing-library/react-native';

import BarChart from '../BarChart';

const mockWithTiming = jest.fn((value: number) => value);

jest.mock('react-native-reanimated', () => ({
  __esModule: true,
  default: { createAnimatedComponent: (Component: any) => Component },
  useSharedValue: (value: number) => require('react').useRef({ value }).current,
  useAnimatedProps: (factory: () => unknown) => factory(),
  withTiming: (value: number) => mockWithTiming(value),
  Easing: { out: (value: unknown) => value, cubic: 'cubic' },
}));
jest.mock('../../theme/themeStore', () => ({
  useAppTheme: () => 'light',
  useThemeRevision: () => 0,
}));
jest.mock('../../i18n/LanguageContext', () => ({
  useLanguage: () => ({ t: (key: string) => key }),
}));
jest.mock('../../context/TabSwipeContext', () => ({
  useTabSwipe: () => ({ setNestedHorizontalGestureActive: jest.fn() }),
}));
jest.mock('@expo/vector-icons', () => {
  const React = require('react');
  const { Text } = require('react-native');
  return { MaterialCommunityIcons: ({ name }: { name: string }) => React.createElement(Text, null, name) };
});

const data = Array.from({ length: 21 }, (_, index) => ({
  id: String(index),
  label: String(index + 1),
  value: index === 2 ? 2000 : index + 1,
}));

const datedData = Array.from({ length: 32 }, (_, index) => {
  const date = new Date(Date.UTC(2026, 6, 21 + index));
  const id = date.toISOString().slice(0, 10);
  return {
    id,
    label: String(date.getUTCDate()),
    value: index === 13 ? 2000 : index + 1,
  };
});

describe('BarChart viewport zoom', () => {
  it('seçim balonunu grafik sayfasının üst sınırı içinde tutar', async () => {
    const screen = await render(<BarChart data={data.slice(0, 7)} height={204} />);

    await fireEvent.press(screen.getByTestId('bar-chart-bar-2'));

    expect(screen.getByTestId('bar-chart-tooltip')).toHaveStyle({ top: 4 });
  });

  it('tam görünümden 14 ve 7 günlük pencerelere kontrollü yakınlaşır', async () => {
    const screen = await render(<BarChart data={data} enableZoom height={160} />);

    expect(screen.getAllByTestId(/^bar-chart-page-\d+$/)).toHaveLength(1);
    await fireEvent.press(screen.getByTestId('bar-chart-zoom-in'));
    expect(screen.getAllByTestId(/^bar-chart-page-\d+$/)).toHaveLength(2);
    await fireEvent.press(screen.getByTestId('bar-chart-zoom-in'));
    expect(screen.getAllByTestId(/^bar-chart-page-\d+$/)).toHaveLength(3);
  });

  it('az veride gereksiz yakınlaştırma kontrolü göstermez', async () => {
    const screen = await render(<BarChart data={data.slice(0, 6)} enableZoom height={160} />);
    expect(screen.queryByTestId('bar-chart-zoom-in')).toBeNull();
  });

  it('32 günlük aralıkta en güncel 14 ve 7 günü tam ve deterministik gösterir', async () => {
    const screen = await render(<BarChart data={datedData} enableZoom height={160} />);

    expect(screen.getByTestId('bar-chart-page-label')).toHaveTextContent(
      '21.07–21.08 · 1/1',
    );
    expect(screen.getByTestId('bar-chart-zoom-out')).toBeDisabled();

    await fireEvent.press(screen.getByTestId('bar-chart-zoom-in'));
    expect(screen.getByTestId('bar-chart-page-label')).toHaveTextContent(
      '08.08–21.08 · 3/3',
    );
    expect(screen.getByTestId('bar-chart-page-2')).toHaveProp(
      'accessibilityLabel',
      '08.08–21.08',
    );

    await fireEvent.press(screen.getByTestId('bar-chart-zoom-in'));
    expect(screen.getByTestId('bar-chart-page-label')).toHaveTextContent(
      '15.08–21.08 · 5/5',
    );
    expect(screen.getByTestId('bar-chart-zoom-in')).toBeDisabled();

    await fireEvent.press(screen.getByTestId('bar-chart-zoom-out'));
    expect(screen.getByTestId('bar-chart-page-label')).toHaveTextContent(
      '08.08–21.08 · 3/3',
    );
  });

  it('eski sayfada zoom yaparken aynı sağ uç tarihini korur', async () => {
    const screen = await render(<BarChart data={datedData} enableZoom height={160} />);
    await fireEvent(screen.getByTestId('bar-chart-viewport'), 'layout', {
      nativeEvent: { layout: { width: 320, height: 160, x: 0, y: 0 } },
    });
    await fireEvent.press(screen.getByTestId('bar-chart-zoom-in'));

    await fireEvent(screen.getByTestId('bar-chart-pager'), 'momentumScrollEnd', {
      nativeEvent: { contentOffset: { x: 320, y: 0 } },
    });
    expect(screen.getByTestId('bar-chart-page-label')).toHaveTextContent(
      '25.07–07.08 · 2/3',
    );

    await fireEvent.press(screen.getByTestId('bar-chart-zoom-in'));
    expect(screen.getByTestId('bar-chart-page-label')).toHaveTextContent(
      '01.08–07.08 · 3/5',
    );

    await fireEvent.press(screen.getByTestId('bar-chart-zoom-out'));
    expect(screen.getByTestId('bar-chart-page-label')).toHaveTextContent(
      '25.07–07.08 · 2/3',
    );
  });

  it('yalnız görünüm penceresi değiştiğinde giriş animasyonunu yeniden başlatmaz', async () => {
    mockWithTiming.mockClear();
    const screen = await render(<BarChart data={datedData} enableZoom height={160} />);
    expect(mockWithTiming).toHaveBeenCalledTimes(1);

    await fireEvent.press(screen.getByTestId('bar-chart-zoom-in'));
    await fireEvent.press(screen.getByTestId('bar-chart-zoom-in'));
    await fireEvent.press(screen.getByTestId('bar-chart-zoom-out'));

    expect(mockWithTiming).toHaveBeenCalledTimes(1);
  });

  it('aynı tarih aralığındaki veri yenilenince görünür pencereyi korur, aralık değişince sıfırlar', async () => {
    const screen = await render(<BarChart data={datedData} enableZoom height={160} />);
    await fireEvent(screen.getByTestId('bar-chart-viewport'), 'layout', {
      nativeEvent: { layout: { width: 320, height: 160, x: 0, y: 0 } },
    });
    await fireEvent.press(screen.getByTestId('bar-chart-zoom-in'));
    await fireEvent(screen.getByTestId('bar-chart-pager'), 'momentumScrollEnd', {
      nativeEvent: { contentOffset: { x: 320, y: 0 } },
    });

    await screen.rerender(
      <BarChart
        data={datedData.map(item => ({ ...item, value: item.value + 10 }))}
        enableZoom
        height={160}
      />,
    );
    expect(screen.getByTestId('bar-chart-page-label')).toHaveTextContent(
      '25.07–07.08 · 2/3',
    );

    await screen.rerender(<BarChart data={datedData.slice(1)} enableZoom height={160} />);
    expect(screen.getByTestId('bar-chart-page-label')).toHaveTextContent(
      '22.07–21.08 · 1/1',
    );
  });
});
