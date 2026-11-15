import React from 'react';
import { Platform, StyleSheet, Text } from 'react-native';
import { render } from '@testing-library/react-native';

import { GlassTabBar, TabBlurProvider, TabBlurScene } from '../GlassTabBar';

jest.mock('expo-blur', () => {
  const React = require('react');
  const { View } = require('react-native');
  return {
    BlurView: (props: any) => React.createElement(View, props),
    BlurTargetView: React.forwardRef((props: any, ref: any) => React.createElement(View, { ...props, ref })),
  };
});

jest.mock('@react-navigation/material-top-tabs', () => {
  const React = require('react');
  const { Text } = require('react-native');
  return { MaterialTopTabBar: () => React.createElement(Text, null, 'tab-bar-items') };
});

jest.mock('../../theme/themeStore', () => ({
  useAppTheme: () => 'dark',
  useThemePalette: () => jest.requireActual('../../theme/colors').resolveTheme('dark', 'blue'),
}));

const routes = [{ key: 'index-1', name: 'index' }, { key: 'analytics-1', name: 'analytics' }];
const barProps = (index: number) => ({ state: { index, routes } } as any);

function Harness({ index, scenes }: { index: number; scenes: string[] }) {
  return (
    <TabBlurProvider>
      {scenes.map(key => (
        <TabBlurScene key={key} routeKey={key}><Text>{key}</Text></TabBlurScene>
      ))}
      <GlassTabBar {...barProps(index)} containerStyle={{ position: 'absolute', height: 65 }} />
    </TabBlurProvider>
  );
}

describe('GlassTabBar', () => {
  const originalOS = Platform.OS;
  beforeEach(() => { (Platform as any).OS = 'android'; });
  afterAll(() => { (Platform as any).OS = originalOS; });

  it('falls back to the plain tint while no scene target is registered', async () => {
    const screen = await render(<Harness index={0} scenes={[]} />);
    const blur = screen.getByTestId('glass-tab-bar-blur');
    expect(blur.props.blurMethod).toBe('none');
    expect(blur.props.blurTarget).toBeUndefined();
    expect(screen.getByText('tab-bar-items')).toBeTruthy();
  });

  it('blurs the focused scene and follows tab changes', async () => {
    const screen = await render(<Harness index={0} scenes={['index-1', 'analytics-1']} />);
    let blur = screen.getByTestId('glass-tab-bar-blur');
    expect(blur.props.blurMethod).toBe('dimezisBlurViewSdk31Plus');
    const first = blur.props.blurTarget;
    expect(first).toBeDefined();

    await screen.rerender(<Harness index={1} scenes={['index-1', 'analytics-1']} />);
    blur = screen.getByTestId('glass-tab-bar-blur');
    expect(blur.props.blurTarget).toBeDefined();
    expect(blur.props.blurTarget).not.toBe(first);
  });

  it('keeps scenes opaque and the floating layout on the container', async () => {
    const screen = await render(<Harness index={0} scenes={['index-1']} />);
    const container = screen.getByTestId('glass-tab-bar');
    const flat = StyleSheet.flatten(container.props.style);
    expect(flat.position).toBe('absolute');
    expect(flat.overflow).toBe('hidden');
  });
});
