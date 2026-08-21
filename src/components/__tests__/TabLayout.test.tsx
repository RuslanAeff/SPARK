import React from 'react';
import { render } from '@testing-library/react-native';
import { StyleSheet } from 'react-native';

import TabLayout from '../../../app/(tabs)/_layout';
import { DarkTheme, LightTheme, resolveTheme, type ThemeAccent } from '../../theme/colors';

let mockScheme: 'light' | 'dark' = 'dark';
let mockAccent: ThemeAccent = 'green';
let mockNavigatorProps: Record<string, any> = {};

jest.mock('expo-router', () => ({
  withLayoutContext: (Navigator: React.ComponentType<any>) => {
    const Wrapped = (props: any) => <Navigator {...props} />;
    Wrapped.Screen = () => null;
    return Wrapped;
  },
}));

jest.mock('@react-navigation/material-top-tabs', () => ({
  createMaterialTopTabNavigator: () => {
    const React = require('react');
    const { View } = require('react-native');
    return {
      Navigator: ({ children, ...props }: any) => {
        mockNavigatorProps = props;
        return React.createElement(View, null, children);
      },
    };
  },
}));

jest.mock('expo-haptics', () => ({
  impactAsync: jest.fn(),
  ImpactFeedbackStyle: { Light: 'light' },
}));

jest.mock('react-native-safe-area-context', () => ({
  useSafeAreaInsets: () => ({ top: 0, right: 0, bottom: 0, left: 0 }),
}));

jest.mock('../../theme/themeStore', () => ({
  useAppTheme: () => mockScheme,
  useThemePalette: () => jest.requireActual('../../theme/colors').resolveTheme(mockScheme, mockAccent),
  getAppThemeSnapshot: () => mockScheme,
}));

jest.mock('../../i18n/LanguageContext', () => ({
  useLanguage: () => ({ t: (key: string) => key }),
}));

describe('Tab navigator themed transition surfaces', () => {
  it('keeps lazy scenes opaque across a runtime theme change', async () => {
    const expectThemeSurface = (background: string) => {
      const options = mockNavigatorProps.screenOptions({ route: { name: 'scanner' } });

      expect(options.lazy).toBe(true);
      expect(StyleSheet.flatten(options.sceneStyle).backgroundColor).toBe(background);
      expect(
        StyleSheet.flatten(options.lazyPlaceholder().props.style).backgroundColor,
      ).toBe(background);
    };

    mockScheme = 'dark';
    const screen = await render(<TabLayout />);
    expectThemeSurface(DarkTheme.background);

    mockScheme = 'light';
    await screen.rerender(<TabLayout />);
    expectThemeSurface(LightTheme.background);

    screen.unmount();
  });

  it('updates the active tab accent without remounting the navigator', async () => {
    mockScheme = 'dark';
    mockAccent = 'green';
    const screen = await render(<TabLayout />);
    expect(mockNavigatorProps.screenOptions({ route: { name: 'scanner' } }).tabBarActiveTintColor)
      .toBe(resolveTheme('dark', 'green').tabActive);

    mockAccent = 'red';
    await screen.rerender(<TabLayout />);
    expect(mockNavigatorProps.screenOptions({ route: { name: 'scanner' } }).tabBarActiveTintColor)
      .toBe(resolveTheme('dark', 'red').tabActive);
  });
});
