import React from 'react';
import { fireEvent, render, within } from '@testing-library/react-native';
import PriceWatchCard from '../PriceWatchCard';
import { getAnalyticsStyles } from '../analyticsStyles';
import type { PriceChange } from '../shared';

const mockSetNestedHorizontalGestureActive = jest.fn();
jest.mock('../../../context/TabSwipeContext', () => ({
  useTabSwipe: () => ({
    swipeEnabled: true,
    setNestedHorizontalGestureActive: mockSetNestedHorizontalGestureActive,
  }),
}));

const base = {
  styles: getAnalyticsStyles(),
  t: (key: string, params?: Record<string, string | number>) =>
    params?.count == null ? key : `${key}:${params.count}`,
  tc: (key: string) => key,
  currency: 'PLN' as const,
};

describe('PriceWatchCard', () => {
  beforeEach(() => mockSetNestedHorizontalGestureActive.mockClear());

  it('değişimleri sabit altılı yatay sayfalara böler', async () => {
    const rows: PriceChange[] = Array.from({ length: 8 }, (_, index) => ({
      name: `Ürün ${index + 1}`,
      turkishName: null,
      firstPrice: 10,
      lastPrice: 11 + index,
      changePct: index + 1,
      purchaseCount: 2,
      measurementUnit: 'piece',
    }));
    const screen = await render(
      <PriceWatchCard {...base} priceChanges={rows} onSelectItem={() => {}} />,
    );

    await fireEvent(screen.getByTestId('price-pager-viewport'), 'layout', {
      nativeEvent: { layout: { width: 300, height: 300, x: 0, y: 0 } },
    });
    const firstPage = within(screen.getByTestId('price-page-0'));
    const secondPage = within(screen.getByTestId('price-page-1'));
    expect(firstPage.getByText('Ürün 1')).toBeTruthy();
    expect(firstPage.getByText('Ürün 6')).toBeTruthy();
    expect(firstPage.queryByText('Ürün 7')).toBeNull();
    expect(secondPage.getByText('Ürün 7')).toBeTruthy();
    expect(secondPage.getByText('Ürün 8')).toBeTruthy();
  });

  it('kart dokunulurken üst sekme kaydırmasını geçici olarak devre dışı bırakır', async () => {
    const row: PriceChange = {
      name: 'Çilek', turkishName: null, firstPrice: 10, lastPrice: 12,
      changePct: 20, purchaseCount: 2, measurementUnit: 'kg',
    };
    const screen = await render(
      <PriceWatchCard {...base} priceChanges={[row]} onSelectItem={() => {}} />,
    );
    const pager = screen.getByTestId('price-pager');
    await fireEvent(pager, 'touchStart');
    await fireEvent(pager, 'touchEnd');
    expect(mockSetNestedHorizontalGestureActive).toHaveBeenNthCalledWith(1, true);
    expect(mockSetNestedHorizontalGestureActive).toHaveBeenNthCalledWith(2, false);
  });
});
