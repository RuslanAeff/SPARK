// react-native-reanimated → __mocks__/react-native-reanimated.js (otomatik)
import React from 'react';
import { render, fireEvent } from '@testing-library/react-native';
import SilentSpendCard from '../SilentSpendCard';
import { getAnalyticsStyles } from '../analyticsStyles';
import type { SilentSpendInfo } from '../shared';

const mockSetNestedHorizontalGestureActive = jest.fn();
jest.mock('../../../context/TabSwipeContext', () => ({
  useTabSwipe: () => ({ setNestedHorizontalGestureActive: mockSetNestedHorizontalGestureActive }),
}));

const base = { styles: getAnalyticsStyles(), t: (k: string) => k, tc: (k: string) => k, currency: 'PLN' as const };

const sampleItem = {
  name: 'Su',
  turkish_name: null,
  purchase_count: 12,
  total_spent: 36,
  avg_price: 3,
  category_name: 'Market',
  category_icon: null,
  category_color: null,
  normalized_key: 'su',
};

describe('SilentSpendCard', () => {
  beforeEach(() => mockSetNestedHorizontalGestureActive.mockClear());
  it('veri yoksa boş durumu gösterir', async () => {
    const info: SilentSpendInfo = { available: false };
    const { getByText } = await render(
      <SilentSpendCard {...base} silentSpendInfo={info} onSelectItem={() => {}} />
    );
    expect(getByText('silent_card_empty_title')).toBeTruthy();
  });

  it('veri varsa başlık + kalem adını gösterir', async () => {
    const info: SilentSpendInfo = {
      available: true, items: [sampleItem], totalAmount: 36, totalCount: 12, distinctItems: 1,
    };
    const { getByText } = await render(
      <SilentSpendCard {...base} silentSpendInfo={info} onSelectItem={() => {}} />
    );
    expect(getByText('silent_card_title')).toBeTruthy();
    expect(getByText('Su')).toBeTruthy();
  });

  it('kaleme dokununca onSelectItem ilgili adla çağrılır', async () => {
    const onSelectItem = jest.fn();
    const info: SilentSpendInfo = {
      available: true, items: [sampleItem], totalAmount: 36, totalCount: 12, distinctItems: 1,
    };
    const { getByText } = await render(
      <SilentSpendCard {...base} silentSpendInfo={info} onSelectItem={onSelectItem} />
    );
    fireEvent.press(getByText('Su'));
    expect(onSelectItem).toHaveBeenCalledWith('Su');
  });

  it('kalemleri beşerli yatay sayfalara böler ve sayfa hareketini izler', async () => {
    const items = Array.from({ length: 11 }, (_, index) => ({
      ...sampleItem,
      name: `Kalem ${index + 1}`,
      normalized_key: `kalem-${index + 1}`,
    }));
    const info: SilentSpendInfo = {
      available: true, items, totalAmount: 99, totalCount: 33, distinctItems: 11,
    };
    const screen = await render(
      <SilentSpendCard {...base} silentSpendInfo={info} onSelectItem={() => {}} />,
    );

    expect(screen.getByTestId('silent-page-0')).toBeTruthy();
    expect(screen.getByTestId('silent-page-1')).toBeTruthy();
    expect(screen.getByTestId('silent-page-2')).toBeTruthy();
    const pager = screen.getByTestId('silent-pager');
    fireEvent(pager, 'touchStart');
    fireEvent(pager, 'touchEnd');

    expect(screen.getByTestId('silent-page-counter').props.children.join('')).toBe('1 / 3');
    expect(mockSetNestedHorizontalGestureActive).toHaveBeenCalledWith(true);
    expect(mockSetNestedHorizontalGestureActive).toHaveBeenLastCalledWith(false);
  });
});
