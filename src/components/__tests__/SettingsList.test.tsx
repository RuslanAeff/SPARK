import React from 'react';
import { StyleSheet, Text } from 'react-native';
import { fireEvent, render } from '@testing-library/react-native';

import { SettingsNavigationRow, SettingsSection } from '../SettingsList';

jest.mock('../../theme/themeStore', () => ({
  useAppTheme: () => 'dark',
}));

jest.mock('@expo/vector-icons', () => {
  const React = require('react');
  const { Text } = require('react-native');
  return {
    MaterialCommunityIcons: ({ name }: { name: string }) =>
      React.createElement(Text, null, name),
  };
});

describe('flat settings primitives', () => {
  it('separates content without restoring a persistent card surface', async () => {
    const screen = await render(
      <SettingsSection testID="flat-section">
        <Text>content</Text>
      </SettingsSection>,
    );

    const style = StyleSheet.flatten(screen.getByTestId('flat-section').props.style);
    expect(style.backgroundColor).toBeUndefined();
    expect(style.borderRadius).toBeUndefined();
    expect(style.borderWidth).toBeUndefined();
    expect(style.borderBottomWidth).toBe(StyleSheet.hairlineWidth);
  });

  it('keeps navigation discoverable as a full-width row', async () => {
    const onPress = jest.fn();
    const screen = await render(
      <SettingsNavigationRow
        testID="flat-navigation-row"
        title="Similar products"
        description="Review saved product matches"
        icon="tag-multiple-outline"
        iconColor="#00FF88"
        iconBackgroundColor="#003322"
        onPress={onPress}
      />,
    );

    expect(screen.getByText('Similar products')).toBeTruthy();
    expect(screen.getByText('Review saved product matches')).toBeTruthy();
    fireEvent.press(screen.getByTestId('flat-navigation-row'));
    expect(onPress).toHaveBeenCalledTimes(1);
  });
});
