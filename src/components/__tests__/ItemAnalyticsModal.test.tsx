import React from 'react';
import { act, render, waitFor } from '@testing-library/react-native';

import ItemAnalyticsModal from '../ItemAnalyticsModal';
import { ExpenseDao } from '../../db/expenseDao';

jest.mock('../../db/expenseDao', () => ({
  ExpenseDao: { getItemAnalytics: jest.fn() },
}));

jest.mock('../BottomSheetModal', () => {
  const { View } = require('react-native');
  return function MockBottomSheetModal({ visible, children }: any) {
    return visible ? <View>{children}</View> : null;
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
});
