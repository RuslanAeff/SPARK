import React from 'react';
import { fireEvent, render } from '@testing-library/react-native';
import MarqueeText from '../MarqueeText';

const mockWithTiming = jest.fn((value: number) => value);

jest.mock('react-native-reanimated', () => {
  const React = require('react');
  const { View } = require('react-native');
  return {
    __esModule: true,
    default: {
      View: ({ children, ...props }: any) => React.createElement(View, props, children),
    },
    useSharedValue: (value: number) => React.useRef({ value }).current,
    useAnimatedStyle: (factory: () => object) => factory(),
    withTiming: (value: number) => mockWithTiming(value),
    withRepeat: (value: number) => value,
    withDelay: (_delay: number, value: number) => value,
    cancelAnimation: jest.fn(),
    Easing: { linear: 'linear' },
  };
});

function measuredText(screen: Awaited<ReturnType<typeof render>>, text: string) {
  const node = screen.getAllByText(text).find(item => typeof item.props.onLayout === 'function');
  if (!node) throw new Error('Marquee ölçüm metni bulunamadı');
  return node;
}

describe('MarqueeText', () => {
  beforeEach(() => jest.clearAllMocks());

  it('keeps a vendor name static when it fits the available width', async () => {
    const screen = await render(<MarqueeText text="MultiSport" />);

    await fireEvent(screen.getByLabelText('MultiSport'), 'layout', {
      nativeEvent: { layout: { width: 96 } },
    });
    await fireEvent(measuredText(screen, 'MultiSport'), 'layout', {
      nativeEvent: { layout: { width: 72 } },
    });

    expect(mockWithTiming).not.toHaveBeenCalled();
    expect(screen.getByLabelText('MultiSport')).toBeTruthy();
  });

  it('moves only an overflowing vendor name from right to left', async () => {
    const screen = await render(<MarqueeText text="Çok Uzun Satıcı İsmi" gap={24} />);

    await fireEvent(screen.getByLabelText('Çok Uzun Satıcı İsmi'), 'layout', {
      nativeEvent: { layout: { width: 90 } },
    });
    await fireEvent(measuredText(screen, 'Çok Uzun Satıcı İsmi'), 'layout', {
      nativeEvent: { layout: { width: 160 } },
    });

    expect(mockWithTiming).toHaveBeenCalledWith(-184);
    expect(screen.getByLabelText('Çok Uzun Satıcı İsmi')).toBeTruthy();
  });
});
