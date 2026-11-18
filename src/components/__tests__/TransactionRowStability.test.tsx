import React from 'react';
import { render } from '@testing-library/react-native';

import TransactionRow from '../TransactionRow';

// Sürükleyerek çoklu seçim, uzun basılan satırın dokunma hedefinin seçim moduna
// geçerken korunmasına dayanır. Satır yeniden oluşturulursa parmağın hedefi
// kaybolur ve sürükleme hiç başlamaz (18 Kasım 2026 bildirimi).
let mockMounts = 0;
jest.mock('../VendorAvatar', () => {
  const ReactModule = require('react');
  const { View } = require('react-native');
  return function MockAvatar() {
    ReactModule.useEffect(() => { mockMounts += 1; }, []);
    return ReactModule.createElement(View);
  };
});
jest.mock('../../theme/themeStore', () => ({ useAppTheme: () => 'dark', useThemeRevision: () => 0 }));
jest.mock('../../i18n/LanguageContext', () => ({ useLanguage: () => ({ t: (k: string) => k, tc: (v: string) => v }) }));
jest.mock('../../context/CurrencyContext', () => ({ useCurrency: () => ({ currency: 'PLN' }) }));
jest.mock('@expo/vector-icons', () => ({ MaterialCommunityIcons: () => null }));

const expense = {
  id: 1, vendor_id: null, category_id: null, total_amount: 12.5, currency: 'PLN', note: null,
  receipt_uri: null, date: '2026-11-18', created_at: '2026-11-18T12:00:00.000Z', vendor_name: 'Shop',
} as any;

it('keeps the pressed row mounted when selection mode starts and the row gets selected', async () => {
  mockMounts = 0;
  const screen = await render(<TransactionRow expense={expense} />);
  expect(mockMounts).toBe(1);

  await screen.rerender(<TransactionRow expense={expense} selectionMode />);
  await screen.rerender(<TransactionRow expense={expense} selectionMode selected />);
  await screen.rerender(<TransactionRow expense={expense} selectionMode selected={false} />);
  await screen.rerender(<TransactionRow expense={expense} />);

  expect(mockMounts).toBe(1);
});
