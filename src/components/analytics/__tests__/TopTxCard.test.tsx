// react-native-reanimated → __mocks__/react-native-reanimated.js (otomatik)
import React from 'react';
import { fireEvent, render } from '@testing-library/react-native';
import TopTxCard from '../TopTxCard';
import { getAnalyticsStyles } from '../analyticsStyles';

const mockSetNestedHorizontalGestureActive = jest.fn();
jest.mock('../../../context/TabSwipeContext', () => ({
  useTabSwipe: () => ({ setNestedHorizontalGestureActive: mockSetNestedHorizontalGestureActive }),
}));

const base = { styles: getAnalyticsStyles(), t: (k: string) => k, tc: (k: string) => k, currency: 'PLN' as const };

describe('TopTxCard', () => {
  beforeEach(() => mockSetNestedHorizontalGestureActive.mockClear());
  it('işlem yoksa hiçbir şey render etmez (null)', async () => {
    const { toJSON } = await render(<TopTxCard {...base} topTx={[]} />);
    expect(toJSON()).toBeNull();
  });

  it('işlemleri satıcı adlarıyla listeler', async () => {
    const topTx = [
      { id: 1, vendor_name: 'Migros', date: '2026-06-21', category_name: 'Market', total_amount: 120 } as any,
      { id: 2, vendor_name: 'Shell', date: '2026-06-20', category_name: 'Yakıt', total_amount: 200 } as any,
    ];
    const { getByText } = await render(<TopTxCard {...base} topTx={topTx} />);
    expect(getByText('top_transactions')).toBeTruthy();
    expect(getByText('Migros')).toBeTruthy();
    expect(getByText('Shell')).toBeTruthy();
  });

  it('satıcı başına seçim modunu kullanıcıya açık başlık ve açıklamayla bildirir', async () => {
    const topTx = [
      { id: 1, vendor_name: 'Satıcı A', date: '2026-05-04', category_name: 'Kategori A', total_amount: 200 } as any,
      { id: 2, vendor_name: 'Satıcı B', date: '2026-12-29', category_name: 'Kategori B', total_amount: 120 } as any,
    ];
    const screen = await render(
      <TopTxCard {...base} topTx={topTx} selection="per-vendor" />,
    );

    expect(screen.getByText('top_transactions_per_vendor')).toBeTruthy();
    expect(screen.getByText('top_transactions_per_vendor_hint')).toBeTruthy();
    expect(screen.queryByText('top_transactions')).toBeNull();
    expect(screen.getByText('Satıcı A')).toBeTruthy();
    expect(screen.getByText('04-05 • Kategori A')).toBeTruthy();
  });

  it('en yüksek işlemleri beşerli sabit sayfalara böler ve sıra numarasını korur', async () => {
    const topTx = Array.from({ length: 10 }, (_, index) => ({
      id: index + 1,
      vendor_name: `Satıcı ${index + 1}`,
      date: `2026-06-${String(21 - index).padStart(2, '0')}`,
      category_name: 'Market',
      total_amount: 200 - index,
    })) as any;
    const screen = await render(<TopTxCard {...base} topTx={topTx} />);
    expect(screen.getByTestId('top-tx-page-0')).toBeTruthy();
    expect(screen.getByTestId('top-tx-page-1')).toBeTruthy();
    expect(screen.getByText('10')).toBeTruthy();
    expect(screen.getByTestId('top-tx-page-counter').props.children.join('')).toBe('1 / 2');

  });

  it('iç yatay kaydırma sırasında ana sekme swipe hareketini kilitler', async () => {
    const topTx = Array.from({ length: 6 }, (_, index) => ({
      id: index + 1,
      vendor_name: `Satıcı ${index + 1}`,
      date: '2026-06-21',
      category_name: 'Market',
      total_amount: 200 - index,
    })) as any;
    const screen = await render(<TopTxCard {...base} topTx={topTx} />);
    const pager = screen.getByTestId('top-tx-pager');

    fireEvent(pager, 'touchStart');
    fireEvent(pager, 'touchEnd');
    expect(mockSetNestedHorizontalGestureActive).toHaveBeenNthCalledWith(1, true);
    expect(mockSetNestedHorizontalGestureActive).toHaveBeenLastCalledWith(false);
  });
});
