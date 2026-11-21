// UX-07: Alt sayfa yükseklik sınırları tek yerde ve canlı pencere boyuyla.
import React from 'react';
import { StyleSheet, Text } from 'react-native';
import { render } from '@testing-library/react-native';

import BottomSheetModal, { DEFAULT_MAX_HEIGHT_RATIO } from '../BottomSheetModal';

jest.mock('../SparkToast', () => ({ SparkToastContainer: () => null }));
jest.mock('react-native-safe-area-context', () => {
  const React = require('react');
  const insets = { top: 24, bottom: 0, left: 0, right: 0 };
  return {
    SafeAreaProvider: ({ children }: any) => React.createElement(React.Fragment, null, children),
    useSafeAreaInsets: () => insets,
    initialWindowMetrics: null,
  };
});
jest.mock('react-native/Libraries/Utilities/useWindowDimensions', () => ({
  __esModule: true,
  default: () => ({ width: 400, height: 600, scale: 1, fontScale: 1 }),
}));

function sheetMaxHeight(screen: Awaited<ReturnType<typeof render>>) {
  const content = screen.getByText('content');
  let node: any = content.parent;
  while (node) {
    const flat = StyleSheet.flatten(node.props?.style);
    if (flat && typeof flat.maxHeight !== 'undefined') return flat.maxHeight;
    node = node.parent;
  }
  return undefined;
}

describe('BottomSheetModal height cap (UX-07)', () => {
  it('caps a sheet without its own limit to the default window ratio', async () => {
    const screen = await render(
      <BottomSheetModal visible onClose={jest.fn()} sheetStyle={{ backgroundColor: '#000' }}>
        <Text>content</Text>
      </BottomSheetModal>,
    );
    expect(sheetMaxHeight(screen)).toBe(600 * DEFAULT_MAX_HEIGHT_RATIO);
  });

  it('never lets a fixed pixel limit pass the status bar', async () => {
    const screen = await render(
      <BottomSheetModal visible onClose={jest.fn()} sheetStyle={{ maxHeight: 900 }}>
        <Text>content</Text>
      </BottomSheetModal>,
    );
    // 600 pencere − 24 üst güvenli alan − 12 nefes payı
    expect(sheetMaxHeight(screen)).toBe(564);
  });

  it('keeps a smaller own limit untouched', async () => {
    const screen = await render(
      <BottomSheetModal visible onClose={jest.fn()} sheetStyle={{ maxHeight: 300 }}>
        <Text>content</Text>
      </BottomSheetModal>,
    );
    expect(sheetMaxHeight(screen)).toBe(300);
  });
});
