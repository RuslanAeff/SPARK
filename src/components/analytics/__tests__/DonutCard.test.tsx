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
  donutAnalysisHint: {},
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
