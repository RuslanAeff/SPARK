import React from 'react';
import { StyleSheet } from 'react-native';
import { fireEvent, render } from '@testing-library/react-native';
import * as Haptics from 'expo-haptics';

import SettingsScreen from '../../../app/(tabs)/settings';

const mockRouterPush = jest.fn();

jest.mock('expo-router', () => ({
  useRouter: () => ({ push: mockRouterPush }),
}));

jest.mock('@react-navigation/native', () => ({
  useIsFocused: () => true,
}));

jest.mock('react-native-safe-area-context', () => {
  const React = require('react');
  const { View } = require('react-native');
  return {
    SafeAreaView: ({ children, ...props }: any) =>
      React.createElement(View, props, children),
  };
});

jest.mock('react-native-reanimated');

jest.mock('@expo/vector-icons', () => {
  const React = require('react');
  const { Text } = require('react-native');
  return {
    MaterialCommunityIcons: ({ name }: { name: string }) =>
      React.createElement(Text, null, name),
  };
});

jest.mock('expo-haptics', () => ({
  impactAsync: jest.fn().mockResolvedValue(undefined),
  ImpactFeedbackStyle: { Light: 'light' },
}));

jest.mock('../../theme/themeStore', () => ({
  useAppTheme: () => 'dark',
  useThemeRevision: () => 1,
}));

jest.mock('../../i18n/LanguageContext', () => ({
  useLanguage: () => ({ t: (key: string) => key }),
}));

jest.mock('../LivingSparkWordmark', () => {
  const React = require('react');
  const { Text } = require('react-native');
  return () => React.createElement(Text, null, 'SPARK');
});

describe('SettingsScreen flat group navigation', () => {
  beforeEach(() => {
    jest.clearAllMocks();
  });

  it('shows the four groups as an unboxed list with only row dividers', async () => {
    const screen = await render(<SettingsScreen />);
    const keys = ['general', 'budget', 'data', 'ai'];

    keys.forEach((key, index) => {
      const row = screen.getByTestId(`settings-group-${key}`);
      const style = StyleSheet.flatten(row.props.style);

      expect(style.backgroundColor).toBeUndefined();
      expect(style.borderWidth).toBeUndefined();
      expect(style.borderRadius).toBeUndefined();
      expect(style.borderBottomWidth).toBe(
        index === keys.length - 1 ? 0 : StyleSheet.hairlineWidth,
      );
    });

    expect(screen.getByText('settings_group_general_desc').props.numberOfLines)
      .toBeUndefined();
  });

  it('keeps navigation and light haptic feedback on the full row', async () => {
    const screen = await render(<SettingsScreen />);

    await fireEvent.press(screen.getByTestId('settings-group-budget'));

    expect(Haptics.impactAsync).toHaveBeenCalledWith('light');
    expect(mockRouterPush).toHaveBeenCalledWith('/settings-budget');
  });
});
