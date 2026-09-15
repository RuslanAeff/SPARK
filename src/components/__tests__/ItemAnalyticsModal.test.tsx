import React from 'react';
import { act, fireEvent, render, waitFor, within } from '@testing-library/react-native';

import ItemAnalyticsModal from '../ItemAnalyticsModal';
import { ExpenseDao } from '../../db/expenseDao';

jest.mock('../../db/expenseDao', () => ({
  ExpenseDao: { getItemAnalytics: jest.fn() },
}));

jest.mock('../BottomSheetModal', () => {
  const { Pressable, View } = require('react-native');
  return function MockBottomSheetModal({ visible, children, onDismiss }: any) {
    return visible ? (
      <View>
        {children}
        <Pressable testID="mock-item-sheet-dismiss" onPress={onDismiss} />
      </View>
    ) : null;
  };
});

jest.mock('../LineChart', () => {
  const { Text } = require('react-native');
  return function MockLineChart({ data }: any) {
    return <Text testID="mock-line-chart">{data.map((point: any) => point.value).join(',')}</Text>;
  };
});

jest.mock('../../i18n/LanguageContext', () => ({
  useLanguage: () => ({
    t: (key: string, params?: Record<string, string>) => {
      if (key === 'price_chart_dense_summary') return `${params?.shown}/${params?.total}`;
      return key;
    },
  }),
}));

jest.mock('../../context/CurrencyContext', () => ({
  useCurrency: () => ({ currency: 'PLN' }),
}));

jest.mock('../../theme/themeStore', () => ({
  useAppTheme: () => 'light',
  useThemeRevision: () => 0,
  getAppThemeSnapshot: () => 'light',
}));

function deferred<T>() {
  let resolve!: (value: T) => void;
  const promise = new Promise<T>((done) => { resolve = done; });
  return { promise, resolve };
}

const resultFor = (firstPrice: number, secondPrice: number) => ({
  stats: {
    total_spent: firstPrice + secondPrice,
    avg_price: (firstPrice + secondPrice) / 2,
    purchase_count: 2,
    total_quantity: 2,
  },
  history: [
    { date: '2026-01-01', unit_price: firstPrice, total_price: firstPrice, quantity: 1, vendor_name: 'Market A' },
    { date: '2026-02-01', unit_price: secondPrice, total_price: secondPrice, quantity: 1, vendor_name: 'Market A' },
  ],
});

describe('ItemAnalyticsModal latest request davranışı', () => {
  beforeEach(() => jest.clearAllMocks());

  it('geç tamamlanan eski ürün sorgusunun yeni ürün grafiğini ezmesine izin vermez', async () => {
    const oldItem = deferred<ReturnType<typeof resultFor>>();
    const newItem = deferred<ReturnType<typeof resultFor>>();
    (ExpenseDao.getItemAnalytics as jest.Mock)
      .mockImplementationOnce(() => oldItem.promise)
      .mockImplementationOnce(() => newItem.promise);

    const screen = await render(
      <ItemAnalyticsModal visible itemName="Ürün A" onClose={jest.fn()} />,
    );
    await waitFor(() => expect(ExpenseDao.getItemAnalytics).toHaveBeenCalledWith('Ürün A'));

    await screen.rerender(
      <ItemAnalyticsModal visible itemName="Ürün B" onClose={jest.fn()} />,
    );
    await waitFor(() => expect(ExpenseDao.getItemAnalytics).toHaveBeenCalledWith('Ürün B'));

    await act(async () => {
      newItem.resolve(resultFor(7, 8));
      await newItem.promise;
    });
    await waitFor(() => expect(screen.getByTestId('mock-line-chart').props.children).toBe('7,8'));

    await act(async () => {
      oldItem.resolve(resultFor(70, 80));
      await oldItem.promise;
      await Promise.resolve();
    });

    expect(screen.getByText('Ürün B')).toBeTruthy();
    expect(screen.getByTestId('mock-line-chart').props.children).toBe('7,8');
  });

  it('alım geçmişini en yeniden eskiye altışarlı yatay sayfalara böler', async () => {
    const history = Array.from({ length: 8 }, (_, index) => ({
      date: `2026-08-${String(index + 1).padStart(2, '0')}`,
      unit_price: index + 1,
      total_price: index + 1,
      quantity: 1,
      vendor_name: `Market ${index + 1}`,
      measurement_unit: 'piece',
    }));
    (ExpenseDao.getItemAnalytics as jest.Mock).mockResolvedValue({
      stats: {
        total_spent: 36,
        avg_price: 4.5,
        purchase_count: 8,
        total_quantity: 8,
        measurement_unit: 'piece',
      },
      history,
    });

    const screen = await render(
      <ItemAnalyticsModal visible itemName="Ürün" onClose={jest.fn()} />,
    );
    await waitFor(() => expect(screen.getByTestId('purchase-history-page-0')).toBeTruthy());
    await fireEvent(screen.getByTestId('purchase-history-pager-viewport'), 'layout', {
      nativeEvent: { layout: { width: 320, height: 280, x: 0, y: 0 } },
    });

    const newestPage = within(screen.getByTestId('purchase-history-page-0'));
    const oldestPage = within(screen.getByTestId('purchase-history-page-1'));
    expect(newestPage.getByText('08.08.2026')).toBeTruthy();
    expect(newestPage.getByText('03.08.2026')).toBeTruthy();
    expect(newestPage.queryByText('02.08.2026')).toBeNull();
    expect(oldestPage.getByText('02.08.2026')).toBeTruthy();
    expect(oldestPage.getByText('01.08.2026')).toBeTruthy();
  });

  it('native kapanış tamamlandığında onDismiss geri dönüşünü iletir', async () => {
    const onDismiss = jest.fn();
    (ExpenseDao.getItemAnalytics as jest.Mock).mockResolvedValue(resultFor(7, 8));
    const screen = await render(
      <ItemAnalyticsModal
        visible
        itemName="Ürün"
        onClose={jest.fn()}
        onDismiss={onDismiss}
      />,
    );

    await fireEvent.press(screen.getByTestId('mock-item-sheet-dismiss'));
    expect(onDismiss).toHaveBeenCalledTimes(1);
  });

  it('tarih seçimini grafik, kıyas ve geçmişe birlikte uygular; yeniden açınca sıfırlar', async () => {
    const dateKey = (daysAgo: number) => {
      const d = new Date();
      d.setDate(d.getDate() - daysAgo);
      return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}`;
    };
    const result = resultFor(70, 8);
    result.history = [
      { ...result.history[0], date: dateKey(120), vendor_name: 'Old Market' },
      { ...result.history[1], date: dateKey(60), vendor_name: 'Recent Market' },
      { ...result.history[1], date: dateKey(40), vendor_name: 'Recent Market', unit_price: 9, total_price: 9 },
    ];
    (ExpenseDao.getItemAnalytics as jest.Mock).mockResolvedValue(result);
    const screen = await render(<ItemAnalyticsModal visible itemName="Ürün" onClose={jest.fn()} />);
    await screen.findByTestId('item-period-90');
    await fireEvent.press(screen.getByTestId('item-period-90'));
    expect(screen.getByTestId('mock-line-chart')).toHaveTextContent('8,9');
    expect(screen.queryByText('Old Market')).toBeNull();
    expect(screen.queryByText(/vendor_comparison/)).toBeNull();
    expect(screen.getByTestId('item-period-90')).toHaveProp('accessibilityState', { checked: true });
    await fireEvent.press(screen.getByTestId('item-period-30'));
    expect(screen.getByText('item_period_empty')).toBeTruthy();
    expect(screen.queryByTestId('purchase-history-pager')).toBeNull();
    expect(screen.queryByTestId('mock-line-chart')).toBeNull();
    expect(ExpenseDao.getItemAnalytics).toHaveBeenCalledTimes(1);
    await screen.rerender(<ItemAnalyticsModal visible={false} itemName="Ürün" onClose={jest.fn()} />);
    await screen.rerender(<ItemAnalyticsModal visible itemName="Ürün" onClose={jest.fn()} />);
    await waitFor(() => expect(screen.getByTestId('item-period-all')).toHaveProp('accessibilityState', { checked: true }));
    expect(screen.queryByText('item_period_empty')).toBeNull();
  });
});
