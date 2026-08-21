import React from 'react';
import { fireEvent, render, within } from '@testing-library/react-native';

import VendorsCard from '../VendorsCard';
import VendorAnalyticsSheet from '../VendorAnalyticsSheet';
import { getAnalyticsStyles } from '../analyticsStyles';

const mockSetNestedHorizontalGestureActive = jest.fn();

jest.mock('../../../context/TabSwipeContext', () => ({
  useTabSwipe: () => ({ setNestedHorizontalGestureActive: mockSetNestedHorizontalGestureActive }),
}));
jest.mock('../../../theme/themeStore', () => ({
  useAppTheme: () => 'light',
  useThemeRevision: () => 0,
}));
jest.mock('../../VendorAvatar', () => {
  const React = require('react');
  const { View } = require('react-native');
  return () => React.createElement(View);
});
jest.mock('../../DonutChart', () => {
  const React = require('react');
  const { View } = require('react-native');
  return ({ innerContent }: any) => React.createElement(View, null, innerContent);
});
jest.mock('../../AnimatedCard', () => {
  const React = require('react');
  const { View } = require('react-native');
  return ({ children, style }: any) => React.createElement(View, { style }, children);
});
jest.mock('../../BottomSheetModal', () => {
  const React = require('react');
  const { Pressable, View } = require('react-native');
  return ({ visible, children, onDismiss }: any) => visible
    ? React.createElement(
      View,
      { testID: 'mock-bottom-sheet' },
      children,
      React.createElement(Pressable, { testID: 'mock-bottom-sheet-dismiss', onPress: onDismiss }),
    )
    : null;
});
jest.mock('../shared', () => {
  const React = require('react');
  const { Text } = require('react-native');
  return {
    CountUpText: ({ value, suffix = '' }: any) => React.createElement(Text, null, `${value}${suffix}`),
  };
});
jest.mock('@expo/vector-icons', () => {
  const React = require('react');
  const { Text } = require('react-native');
  return { MaterialCommunityIcons: ({ name }: { name: string }) => React.createElement(Text, null, name) };
});

const vendors = Array.from({ length: 12 }, (_, index) => ({
  vendor_id: index + 1,
  vendor_name: `Satıcı ${index + 1}`,
  vendor_logo: null,
  total: 1200 - index * 50,
  percentage: Math.max(1, 40 - index),
}));

const items = [
  { name: 'Pahalı Ürün', purchase_count: 1, total_spent: 500, normalized_key: 'pahali' },
  { name: 'Sık Ürün', purchase_count: 9, total_spent: 90, normalized_key: 'sik' },
  { name: 'Ürün C', purchase_count: 8, total_spent: 80, normalized_key: 'c' },
  { name: 'Ürün D', purchase_count: 7, total_spent: 70, normalized_key: 'd' },
  { name: 'Ürün E', purchase_count: 6, total_spent: 60, normalized_key: 'e' },
  { name: 'Ürün F', purchase_count: 5, total_spent: 50, normalized_key: 'f' },
  { name: 'Ürün G', purchase_count: 4, total_spent: 40, normalized_key: 'g' },
];

const t = (key: string, params?: Record<string, string | number>) => (
  key === 'pieces' ? `${params?.count}x` : key
);
const base = {
  styles: getAnalyticsStyles(),
  t,
  tc: (key: string) => key,
  currency: 'PLN' as const,
};

describe('VendorsCard vendor pager', () => {
  beforeEach(() => mockSetNestedHorizontalGestureActive.mockClear());

  it('satıcıları beşerli, sabit yatay sayfalara böler', async () => {
    const screen = await render(
      <VendorsCard
        {...base}
        vendors={vendors}
        prevVendorTotals={new Map()}
        handleVendorPress={jest.fn()}
      />,
    );

    expect(within(screen.getByTestId('vendor-page-0')).getByText('Satıcı 5')).toBeTruthy();
    expect(within(screen.getByTestId('vendor-page-1')).getByText('Satıcı 10')).toBeTruthy();
    expect(within(screen.getByTestId('vendor-page-2')).getByText('Satıcı 12')).toBeTruthy();
    expect(screen.getByTestId('vendor-page-counter')).toHaveTextContent('1 / 3');
  });

  it('iç kaydırmada sekme hareketini kilitler ve sayfa göstergesini günceller', async () => {
    const screen = await render(
      <VendorsCard
        {...base}
        vendors={vendors}
        prevVendorTotals={new Map()}
        handleVendorPress={jest.fn()}
      />,
    );
    await fireEvent(screen.getByTestId('vendor-pager-viewport'), 'layout', {
      nativeEvent: { layout: { width: 300 } },
    });
    const pager = screen.getByTestId('vendor-pager');
    await fireEvent(pager, 'touchStart');
    await fireEvent(pager, 'momentumScrollEnd', { nativeEvent: { contentOffset: { x: 300 } } });

    expect(mockSetNestedHorizontalGestureActive).toHaveBeenCalledWith(true);
    expect(mockSetNestedHorizontalGestureActive).toHaveBeenLastCalledWith(false);
    expect(screen.getByTestId('vendor-page-counter')).toHaveTextContent('2 / 3');
  });

  it('gerçek satır dokunuşunu ayrıntı açma callbackine iletir', async () => {
    const handleVendorPress = jest.fn();
    const screen = await render(
      <VendorsCard
        {...base}
        vendors={vendors}
        prevVendorTotals={new Map()}
        handleVendorPress={handleVendorPress}
      />,
    );

    await fireEvent.press(screen.getByTestId('vendor-row-3'));
    expect(handleVendorPress).toHaveBeenCalledWith(3);
  });
});

describe('VendorAnalyticsSheet', () => {
  beforeEach(() => mockSetNestedHorizontalGestureActive.mockClear());

  it('ürünleri varsayılan olarak alım sayısına göre beşerli sayfalara böler', async () => {
    const screen = await render(
      <VendorAnalyticsSheet
        {...base}
        visible
        vendor={vendors[0]}
        items={items}
        loading={false}
        onClose={jest.fn()}
        onSelectItem={jest.fn()}
      />,
    );

    const firstPage = within(await screen.findByTestId('vendor-item-page-0'));
    const secondPage = within(await screen.findByTestId('vendor-item-page-1'));
    expect(firstPage.getByText('Sık Ürün')).toBeTruthy();
    expect(firstPage.queryByText('Pahalı Ürün')).toBeNull();
    expect(secondPage.getByText('Pahalı Ürün')).toBeTruthy();
  });

  it('toplam tutar seçildiğinde sıralamayı deterministik biçimde yeniler', async () => {
    const screen = await render(
      <VendorAnalyticsSheet
        {...base}
        visible
        vendor={vendors[0]}
        items={items}
        loading={false}
        onClose={jest.fn()}
        onSelectItem={jest.fn()}
      />,
    );

    await fireEvent.press(await screen.findByTestId('vendor-item-sort-spending'));
    expect(within(screen.getByTestId('vendor-item-page-0')).getByText('Pahalı Ürün')).toBeTruthy();
    expect(screen.getByText('top_spent_products')).toBeTruthy();
  });

  it('ürün ayrıntısını satıcı paneli kapandıktan sonra açar', async () => {
    const onClose = jest.fn();
    const onSelectItem = jest.fn();
    const screen = await render(
      <VendorAnalyticsSheet
        {...base}
        visible
        vendor={vendors[0]}
        items={items}
        loading={false}
        onClose={onClose}
        onSelectItem={onSelectItem}
      />,
    );

    await fireEvent.press(within(await screen.findByTestId('vendor-item-page-0')).getByText('Sık Ürün'));
    expect(onClose).toHaveBeenCalledTimes(1);
    expect(onSelectItem).not.toHaveBeenCalled();

    await fireEvent.press(screen.getByTestId('mock-bottom-sheet-dismiss'));
    expect(onSelectItem).toHaveBeenCalledWith('Sık Ürün');
  });
});
