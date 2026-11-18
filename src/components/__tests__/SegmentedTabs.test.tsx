import React, { useState } from 'react';
import { Text } from 'react-native';
import { fireEvent, render } from '@testing-library/react-native';

import { SegmentedContent, SegmentedTabs } from '../SegmentedTabs';

jest.mock('../../theme/themeStore', () => ({ useAppTheme: () => 'dark', useThemeRevision: () => 0 }));
jest.mock('expo-haptics', () => ({ selectionAsync: jest.fn(() => Promise.resolve()) }));
jest.mock('react-native-svg', () => {
  const React = require('react');
  const { View } = require('react-native');
  const Stub = ({ children }: any) => React.createElement(View, null, children);
  return { __esModule: true, default: Stub, Defs: Stub, LinearGradient: Stub, Rect: Stub, Stop: Stub };
});

const ORDER = ['open', 'history'] as const;

function Harness({ onChange }: { onChange: jest.Mock }) {
  const [value, setValue] = useState<(typeof ORDER)[number]>('open');
  return (
    <>
      <SegmentedTabs
        options={ORDER.map(key => ({ key, label: key, testID: `tab-${key}` }))}
        value={value}
        onChange={(key) => { onChange(key); setValue(key); }}
      />
      <SegmentedContent order={ORDER} value={value}>
        <Text>{`content-${value}`}</Text>
      </SegmentedContent>
    </>
  );
}

describe('SegmentedTabs', () => {
  it('exposes tab semantics, switches content and ignores taps on the active tab', async () => {
    const onChange = jest.fn();
    const screen = await render(<Harness onChange={onChange} />);
    expect(screen.getByTestId('tab-open').props.accessibilityState).toEqual({ selected: true });
    expect(screen.getByText('content-open')).toBeTruthy();

    await fireEvent.press(screen.getByTestId('tab-open'));
    expect(onChange).not.toHaveBeenCalled();

    await fireEvent.press(screen.getByTestId('tab-history'));
    expect(onChange).toHaveBeenCalledWith('history');
    expect(screen.getByTestId('tab-history').props.accessibilityState).toEqual({ selected: true });
    expect(screen.getByText('content-history')).toBeTruthy();
    expect(screen.queryByText('content-open')).toBeNull();
  });
});
