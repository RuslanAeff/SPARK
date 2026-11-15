import React from 'react';
import { StyleSheet } from 'react-native';
import { fireEvent, render } from '@testing-library/react-native';

import PrimaryButton from '../PrimaryButton';
import { resolveTheme } from '../../theme/colors';

jest.mock('../../theme/themeStore', () => ({ useAppTheme: () => 'dark', useThemeRevision: () => 0 }));
jest.mock('@expo/vector-icons', () => {
  const React = require('react');
  const { Text } = require('react-native');
  return { MaterialCommunityIcons: ({ name, color }: any) => React.createElement(Text, { testID: `icon-${name}`, color }, name) };
});

describe('PrimaryButton (DS-07)', () => {
  it('uses the susevar fill and onPrimary content', async () => {
    const onPress = jest.fn();
    const screen = await render(<PrimaryButton testID="btn" label="Save" icon="camera" onPress={onPress} />);
    const theme = resolveTheme('dark');
    const button = screen.getByTestId('btn');
    expect(StyleSheet.flatten(button.props.style).backgroundColor).toBe(theme.primaryAction);
    expect(screen.getByTestId('icon-camera').props.color).toBe(theme.onPrimary);
    expect(button.props.accessibilityRole).toBe('button');
    await fireEvent.press(button);
    expect(onPress).toHaveBeenCalledTimes(1);
  });

  it('blocks presses and reports state while disabled or loading', async () => {
    const onPress = jest.fn();
    const screen = await render(<PrimaryButton testID="btn" label="Save" onPress={onPress} loading />);
    const button = screen.getByTestId('btn');
    expect(button.props.accessibilityState).toEqual({ disabled: true, busy: true });
    expect(screen.queryByText('Save')).toBeNull();
    await fireEvent.press(button);
    expect(onPress).not.toHaveBeenCalled();
  });

  it('compact size keeps a 44 dp minimum touch target', async () => {
    const screen = await render(<PrimaryButton testID="btn" size="compact" label="Apply" onPress={jest.fn()} />);
    expect(StyleSheet.flatten(screen.getByTestId('btn').props.style).minHeight).toBe(44);
  });
});
