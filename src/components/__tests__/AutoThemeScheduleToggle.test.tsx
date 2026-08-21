import React from 'react';
import { fireEvent, render } from '@testing-library/react-native';

import AutoThemeScheduleToggle from '../AutoThemeScheduleToggle';
import * as Haptics from 'expo-haptics';

jest.mock('react-native-reanimated', () => {
  const React = require('react');
  const { View } = require('react-native');
  return {
    __esModule: true,
    default: {
      View: ({ children, ...props }: any) => React.createElement(View, props, children),
    },
    useSharedValue: (value: number) => ({ value }),
    useAnimatedStyle: (factory: () => object) => factory(),
    withTiming: (value: number) => value,
    Easing: { bezier: () => undefined },
  };
});

jest.mock('@expo/vector-icons', () => {
  const React = require('react');
  const { Text } = require('react-native');
  return {
    MaterialCommunityIcons: ({ name }: { name: string }) =>
      React.createElement(Text, null, name),
  };
});

jest.mock('expo-haptics', () => ({
  impactAsync: jest.fn(),
  ImpactFeedbackStyle: { Medium: 'medium' },
}));

describe('AutoThemeScheduleToggle', () => {
  beforeEach(() => jest.clearAllMocks());

  it('keeps the original switch semantics and toggles once', async () => {
    const onToggle = jest.fn();
    const screen = await render(
      <AutoThemeScheduleToggle
        testID="auto-theme"
        enabled
        onToggle={onToggle}
        labelOn="Auto on"
        labelOff="Manual off"
      />,
    );

    const toggle = screen.getByTestId('auto-theme');
    expect(toggle.props.accessibilityRole).toBe('switch');
    expect(toggle.props.accessibilityState).toEqual({ checked: true, disabled: false });

    await fireEvent.press(toggle);

    expect(onToggle).toHaveBeenCalledTimes(1);
    expect(onToggle).toHaveBeenCalledWith(false);
    expect(Haptics.impactAsync).toHaveBeenCalledTimes(1);
  });

  it('blocks interaction while the preference write is pending', async () => {
    const onToggle = jest.fn();
    const screen = await render(
      <AutoThemeScheduleToggle
        testID="auto-theme"
        enabled={false}
        disabled
        onToggle={onToggle}
        labelOn="Auto on"
        labelOff="Manual off"
      />,
    );

    const toggle = screen.getByTestId('auto-theme');
    expect(toggle.props.accessibilityState).toEqual({ checked: false, disabled: true });
    await fireEvent.press(toggle);

    expect(onToggle).not.toHaveBeenCalled();
    expect(Haptics.impactAsync).not.toHaveBeenCalled();
  });
});
