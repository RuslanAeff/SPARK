import React from 'react';
import { fireEvent, render } from '@testing-library/react-native';
import DonutCard from '../DonutCard';

jest.mock('../../AnimatedCard', () => {
  const React = require('react');
  const { View } = require('react-native');
  return ({ children }: { children: React.ReactNode }) => React.createElement(View, null, children);
});
jest.mock('../../DonutChart', () => {
  const React = require('react');
  const { View } = require('react-native');
  return () => React.createElement(View, { testID: 'donut-chart' });
});
jest.mock('../../SettingsInfoHint', () => {
  const React = require('react');
  const { Pressable, Text, View } = require('react-native');
  return {
    SettingsInfoIconButton: ({ onPress, accessibilityLabel }: any) => (
      React.createElement(Pressable, { testID: 'behavior-info', accessibilityLabel, onPress })
    ),
    SettingsInfoHintModal: ({ visible, title, paragraphs }: any) => visible ? (
      React.createElement(View, null,
        React.createElement(Text, null, title),
        ...paragraphs.map((paragraph: string) => React.createElement(Text, { key: paragraph }, paragraph)),
      )
    ) : null,
  };
});
jest.mock('../../../theme/themeStore', () => ({ useThemeRevision: () => 0 }));
jest.mock('@expo/vector-icons', () => ({ MaterialCommunityIcons: () => null }));

const styles: any = {
  section: {}, primaryCard: {}, sectionTitle: {}, donutCard: {}, trendTitle: {},
  donutCenter: {}, donutTotal: {}, donutLabel: {}, donutSub: {},
  donutAnalysisContainer: {}, donutAnalysisText: {}, donutAnalysisHintRow: {},
  donutAnalysisHint: {}, donutAnalysisNavRow: {}, donutNavButton: {},
  donutNavButtonPressed: {}, donutAnalysisTextFlex: {},
};

describe('DonutCard davranış sınıflandırması bilgisi', () => {
  it('bilgi düğmesinde ihtiyaç, keyif ve diğer kategorileri açıklar', async () => {
    const screen = await render(
      <DonutCard
        styles={styles}
        t={(key: string) => key}
        tc={(key: string) => key}
        currency="PLN"
        needsWants={[{ segment: 'needs', percentage: 100, total: 10, color: '#00a' }]}
        weekWeekend={[]}
        nwSegments={[]}
        wwSegments={[]}
        selectedNWIdx={null}
        selectedWWIdx={null}
        handleNWSelect={jest.fn()}
        handleWWSelect={jest.fn()}
        handleNWMove={jest.fn()}
        handleWWMove={jest.fn()}
      />,
    );

    await fireEvent.press(screen.getByTestId('behavior-info'));

    expect(screen.getByText('behavioral_analysis_info_title')).toBeTruthy();
    expect(screen.getByText('behavioral_analysis_info_needs')).toBeTruthy();
    expect(screen.getByText('behavioral_analysis_info_wants')).toBeTruthy();
    expect(screen.getByText('behavioral_analysis_info_other')).toBeTruthy();
    expect(screen.getByText('behavioral_analysis_info_note')).toBeTruthy();
  });
});

describe('DonutCard önceki/sonraki dilim gezinmesi', () => {
  const needsWants = [
    { segment: 'needs', percentage: 70, total: 700, color: '#00a' },
    { segment: 'wants', percentage: 30, total: 300, color: '#0a0' },
  ];
  const weekWeekend = [
    { segment: 'weekday', percentage: 60, total: 600, color: '#a00' },
    { segment: 'weekend', percentage: 40, total: 400, color: '#a0a' },
  ];

  it('seçim yokken kaydırma ipucunu gösterir, ok kontrollerini gizler', async () => {
    const screen = await render(
      <DonutCard
        styles={styles}
        t={(key: string) => key}
        tc={(key: string) => key}
        currency="PLN"
        needsWants={needsWants}
        weekWeekend={weekWeekend}
        nwSegments={[]}
        wwSegments={[]}
        selectedNWIdx={null}
        selectedWWIdx={null}
        handleNWSelect={jest.fn()}
        handleWWSelect={jest.fn()}
        handleNWMove={jest.fn()}
        handleWWMove={jest.fn()}
      />,
    );

    expect(screen.getByText('donut_hint_swipe_right')).toBeTruthy();
    expect(screen.queryByTestId('donut-nw-previous')).toBeNull();
    expect(screen.queryByTestId('donut-nw-next')).toBeNull();
  });

  it('bir dilim seçiliyken küçük dilimlere dokunmadan ok kontrolleriyle sırayla geçer', async () => {
    const handleNWMove = jest.fn();
    const handleWWMove = jest.fn();
    const screen = await render(
      <DonutCard
        styles={styles}
        t={(key: string) => key}
        tc={(key: string) => key}
        currency="PLN"
        needsWants={needsWants}
        weekWeekend={weekWeekend}
        nwSegments={[]}
        wwSegments={[]}
        selectedNWIdx={0}
        selectedWWIdx={1}
        handleNWSelect={jest.fn()}
        handleWWSelect={jest.fn()}
        handleNWMove={handleNWMove}
        handleWWMove={handleWWMove}
      />,
    );

    expect(screen.queryByText('donut_hint_swipe_right')).toBeNull();
    expect(screen.queryByText('donut_hint_swipe_left')).toBeNull();

    await fireEvent.press(screen.getByTestId('donut-nw-next'));
    expect(handleNWMove).toHaveBeenCalledWith(1);
    await fireEvent.press(screen.getByTestId('donut-nw-previous'));
    expect(handleNWMove).toHaveBeenCalledWith(-1);

    await fireEvent.press(screen.getByTestId('donut-ww-next'));
    expect(handleWWMove).toHaveBeenCalledWith(1);
    await fireEvent.press(screen.getByTestId('donut-ww-previous'));
    expect(handleWWMove).toHaveBeenCalledWith(-1);
  });
});
