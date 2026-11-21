import React from 'react';
import { Animated, Platform, StyleSheet, Text } from 'react-native';
import { render } from '@testing-library/react-native';

import { fireEvent } from '@testing-library/react-native';

import { GlassTabBar, GlassTabIndicator, TabBlurProvider, TabBlurScene } from '../GlassTabBar';
import { SELECTOR_HEIGHT, SELECTOR_RADIUS, computeTabBarGeometry, selectorOffset } from '../tabBarLayout';

jest.mock('expo-blur', () => {
  const React = require('react');
  const { View } = require('react-native');
  return {
    BlurView: (props: any) => React.createElement(View, props),
    BlurTargetView: React.forwardRef((props: any, ref: any) => React.createElement(View, { ...props, ref })),
  };
});

jest.mock('../../theme/themeStore', () => ({
  useAppTheme: () => 'dark',
  useThemePalette: () => jest.requireActual('../../theme/colors').resolveTheme('dark', 'blue'),
}));

const routes = [{ key: 'index-1', name: 'index' }, { key: 'analytics-1', name: 'analytics' }];
const navigation = { emit: jest.fn(() => ({ defaultPrevented: false })), navigate: jest.fn() };
const descriptors = {
  'index-1': { options: { title: 'Dashboard' } },
  'analytics-1': { options: { title: 'Analiz' } },
};
const barProps = (index: number) => ({
  state: { index, routes },
  navigation,
  descriptors,
  position: new Animated.Value(index),
} as any);

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
    expect(screen.getByTestId('tab-index')).toBeTruthy();
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

describe('GlassTabBar items', () => {
  beforeEach(() => jest.clearAllMocks());

  it('emits tabPress and navigates only to an unfocused tab', async () => {
    const screen = await render(<Harness index={0} scenes={[]} />);
    await fireEvent.press(screen.getByTestId('tab-analytics'));
    expect(navigation.emit).toHaveBeenCalledWith({ type: 'tabPress', target: 'analytics-1', canPreventDefault: true });
    expect(navigation.navigate).toHaveBeenCalledWith('analytics', undefined);

    navigation.navigate.mockClear();
    await fireEvent.press(screen.getByTestId('tab-index'));
    expect(navigation.navigate).not.toHaveBeenCalled();
  });

  it('respects a prevented tabPress (navigation lock)', async () => {
    navigation.emit.mockReturnValueOnce({ defaultPrevented: true });
    const screen = await render(<Harness index={0} scenes={[]} />);
    await fireEvent.press(screen.getByTestId('tab-analytics'));
    expect(navigation.navigate).not.toHaveBeenCalled();
  });

  it('exposes tab roles with the selected state', async () => {
    const screen = await render(<Harness index={1} scenes={[]} />);
    expect(screen.getByTestId('tab-analytics').props.accessibilityState).toEqual({ selected: true });
    expect(screen.getByTestId('tab-index').props.accessibilityState).toEqual({ selected: false });
  });
});

describe('GlassTabIndicator', () => {
  const position = new Animated.Value(0) as unknown as Animated.AnimatedInterpolation<number>;

  it('draws a soft-cornered rectangle wrapping icon and label', async () => {
    const geometry = computeTabBarGeometry(353, 5, []);
    const screen = await render(<GlassTabIndicator position={position} routeCount={5} geometry={geometry} />);
    const flat = StyleSheet.flatten(screen.getByTestId('glass-tab-indicator').props.style);
    expect(flat.width).toBe(geometry.selectorWidth);
    expect(flat.height).toBe(SELECTOR_HEIGHT);
    expect(flat.borderRadius).toBe(SELECTOR_RADIUS);
    expect(flat.borderRadius).toBeLessThan(SELECTOR_HEIGHT / 2);
    expect(selectorOffset(0, geometry)).toBeCloseTo(6.5, 5);
  });

  it('renders nothing before the bar is measured', async () => {
    const geometry = computeTabBarGeometry(0, 5, []);
    const screen = await render(<GlassTabIndicator position={position} routeCount={5} geometry={geometry} />);
    expect(screen.queryByTestId('glass-tab-indicator')).toBeNull();
  });
});
