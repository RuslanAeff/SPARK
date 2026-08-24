import React from 'react';
import { render } from '@testing-library/react-native';

import TransactionRow from '../TransactionRow';
import type { ExpenseWithDetails } from '../../db/schema';
import { formatCurrency } from '../../utils/formatCurrency';

jest.mock('../../theme/themeStore', () => ({
  useAppTheme: () => 'dark',
  useThemeRevision: () => 0,
}));

jest.mock('../../i18n/LanguageContext', () => ({
  useLanguage: () => ({
    t: (key: string) => key,
    tc: (value: string) => value,
  }),
}));

jest.mock('../../context/CurrencyContext', () => ({
  useCurrency: () => ({ currency: 'PLN' }),
}));

jest.mock('../VendorAvatar', () => {
  const ReactModule = require('react');
  const { View } = require('react-native');
  return ({ name }: { name: string }) => ReactModule.createElement(View, { testID: `avatar-${name}` });
});

const baseExpense: ExpenseWithDetails = {
  id: 1,
  vendor_id: null,
  category_id: null,
  total_amount: 12.5,
  currency: 'USD',
  note: null,
  receipt_uri: null,
  date: '2026-08-23',
  created_at: '2026-08-23T12:00:00.000Z',
  vendor_name: 'Shop',
  category_name: 'Market',
};

describe('TransactionRow currency', () => {
  it('işlemin kayıtlı para birimini uygulamanın varsayılanına tercih eder', async () => {
    const screen = await render(<TransactionRow expense={baseExpense} />);

    expect(screen.getByText(formatCurrency(12.5, 'USD'))).toBeTruthy();
    expect(screen.queryByText(formatCurrency(12.5, 'PLN'))).toBeNull();
  });

  it('eski kayıtta para birimi boşsa uygulama varsayılanını kullanır', async () => {
    const screen = await render(<TransactionRow expense={{ ...baseExpense, currency: '' }} />);

    expect(screen.getByText(formatCurrency(12.5, 'PLN'))).toBeTruthy();
  });
});
