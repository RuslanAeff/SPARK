import React from 'react';
import { fireEvent, render } from '@testing-library/react-native';

import TransactionsScreen from '../../../app/(tabs)/transactions';

const mockExpenses = [1, 2, 3].map(id => ({
  id, date: '2026-11-15', total_amount: id * 10, currency: 'PLN', vendor_name: `V${id}`,
}));

jest.mock('expo-router', () => ({
  useFocusEffect: jest.fn(),
  useRouter: () => ({ push: jest.fn() }),
}));
jest.mock('@react-navigation/native', () => ({ useIsFocused: () => true }));
jest.mock('expo-haptics', () => ({
  impactAsync: jest.fn(), selectionAsync: jest.fn(), notificationAsync: jest.fn(),
  ImpactFeedbackStyle: { Medium: 'medium' }, NotificationFeedbackType: { Success: 'success' },
}));
jest.mock('react-native-safe-area-context', () => {
  const { View } = require('react-native');
  return { SafeAreaView: View };
});
jest.mock('@expo/vector-icons', () => ({ MaterialCommunityIcons: () => null }));
jest.mock('../../theme/themeStore', () => ({ useAppTheme: () => 'dark', useThemeRevision: () => 0 }));
jest.mock('../../i18n/LanguageContext', () => ({
  useLanguage: () => ({
    t: (key: string, params?: Record<string, string>) => (params?.count ? `${key}:${params.count}` : key),
    tc: (key: string) => key,
  }),
}));
jest.mock('../../context/RefreshContext', () => ({
  useExpenseDataRefresh: jest.fn(),
  useRefreshActions: () => ({ triggerRefresh: jest.fn() }),
}));
jest.mock('../../hooks/useExpenses', () => ({
  usePaginatedExpenses: () => ({
    items: mockExpenses, loading: false, loadingMore: false, hasMore: false,
    refresh: jest.fn(async () => undefined), loadMore: jest.fn(),
  }),
  useExpenseSearch: () => ({
    active: false, items: [], loadingMore: false, hasMore: false,
    refresh: jest.fn(async () => undefined), loadMore: jest.fn(),
  }),
}));
jest.mock('../GlassDeleteModal', () => () => null);
jest.mock('../TransactionRow', () => {
  const React = require('react');
  const { Pressable, Text } = require('react-native');
  return ({ expense, selected, onPress, onLongPress }: any) => React.createElement(
    Pressable,
    { testID: `row-${expense.id}`, onPress, onLongPress },
    React.createElement(Text, null, `${expense.vendor_name}${selected ? ':selected' : ''}`),
  );
});

describe('Transactions multi-select (FN-02)', () => {
  it('long-pressing another row in selection mode keeps the earlier selection', async () => {
    const screen = await render(<TransactionsScreen />);

    await fireEvent(screen.getByTestId('row-1'), 'longPress');
    await fireEvent.press(screen.getByTestId('row-2'));
    expect(screen.getByText('transactions_selected:2')).toBeTruthy();

    await fireEvent(screen.getByTestId('row-3'), 'longPress');
    expect(screen.getByText('transactions_selected:3')).toBeTruthy();
    expect(screen.getByText('V1:selected')).toBeTruthy();
    expect(screen.getByText('V2:selected')).toBeTruthy();
    expect(screen.getByText('V3:selected')).toBeTruthy();
  });
});
