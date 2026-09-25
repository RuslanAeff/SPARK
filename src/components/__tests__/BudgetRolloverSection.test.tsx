import React from 'react';
import { act, fireEvent, render, waitFor } from '@testing-library/react-native';

import BudgetRolloverSection from '../BudgetRolloverSection';
import { BudgetDao } from '../../db/budgetDao';
import { BudgetRolloverDao } from '../../db/budgetRolloverDao';
import { SparkToast } from '../SparkToast';
import type { Budget } from '../../db/schema';

jest.mock('react-native-reanimated', () => {
  const { View, Easing } = require('react-native');
  const { useRef } = require('react');
  return {
    __esModule: true,
    default: { View },
    Easing,
    ReduceMotion: { System: 'system' },
    useSharedValue: (value: unknown) => useRef({ value }).current,
    useAnimatedStyle: (callback: () => unknown) => callback(),
    withTiming: (value: unknown) => value,
  };
});


const mockTriggerRefresh = jest.fn();
const mockSync = jest.fn(async () => undefined);

jest.mock('../../utils/dateUtils', () => ({ getToday: () => '2026-09-21' }));

jest.mock('../../db/budgetDao', () => ({
  BudgetDao: { getContainingDate: jest.fn() },
}));

// previousDay gerçek takvim yardımıdır; mock edilen modülde de doğru gün dönmeli,
// aksi halde "bitişik dönem" koşulu testte yapay olarak sağlanır/bozulur.
jest.mock('../../db/budgetRolloverDao', () => ({
  BudgetRolloverDao: { status: jest.fn(), save: jest.fn() },
  previousDay: (date: string) => {
    const [y, m, d] = date.split('-').map(Number);
    return new Date(Date.UTC(y, m - 1, d - 1)).toISOString().slice(0, 10);
  },
}));

jest.mock('@expo/vector-icons', () => {
  const React = require('react');
  const { Text } = require('react-native');
  return {
    MaterialCommunityIcons: ({ name }: { name: string }) => React.createElement(Text, null, name),
  };
});

jest.mock('../../theme/themeStore', () => ({
  useAppTheme: () => 'dark',
  useThemePalette: () => ({
    surface: '#111', textPrimary: '#fff', textSecondary: '#ccc',
    border: '#333', primary: '#0f0', primaryAction: '#0f0', danger: '#f00', warning: '#fa0',
  }),
}));
jest.mock('../../theme/susevar', () => ({ createSusevarStyles: () => ({ button: {}, text: {} }) }));

jest.mock('../../i18n/LanguageContext', () => ({
  useLanguage: () => ({ t: (key: string) => key }),
}));
jest.mock('../../context/RefreshContext', () => ({
  useRefresh: () => ({ refreshKey: 0, triggerRefresh: mockTriggerRefresh }),
}));
jest.mock('../../context/NotificationsContext', () => ({
  useNotifications: () => ({ sync: mockSync }),
}));
jest.mock('../../notifications/syncNotificationsBestEffort', () => ({
  syncNotificationsBestEffort: jest.fn(async () => undefined),
}));
jest.mock('../SparkToast', () => ({ SparkToast: { show: jest.fn() } }));
jest.mock('../ConfirmModal', () => {
  const React = require('react');
  const { Pressable, Text } = require('react-native');
  return ({ visible, onConfirm }: any) => visible
    ? React.createElement(
        Pressable,
        { testID: 'rollover-reverse-confirm', onPress: onConfirm },
        React.createElement(Text, null, 'confirm'),
      )
    : null;
});

const budget = (over: Partial<Budget>): Budget => ({
  id: 2,
  monthly_amount: 800,
  currency: 'PLN',
  start_date: '2026-09',
  period_start: '2026-09-01',
  period_end: '2026-09-30',
  cycle_start_day: 1,
  active: 1,
  ...over,
} as Budget);

const source = budget({ id: 1, monthly_amount: 1000, start_date: '2026-08', period_start: '2026-08-01', period_end: '2026-08-31' });

const status = (over: Partial<Awaited<ReturnType<typeof BudgetRolloverDao.status>>> = {}) => ({
  incoming: 0, outgoing: 0, periodRemaining: 0, unallocated: 0, needsReview: false, records: [], ...over,
});

const record = {
  uid: 'u-1',
  source_start: '2026-08-01', source_end: '2026-08-31',
  target_start: '2026-09-01', target_end: '2026-09-30',
  currency: 'PLN', amount_minor: 2000,
  created_at: '2026-09-01T10:00:00Z', updated_at: '2026-09-01T10:00:00Z',
};

const getContainingDate = BudgetDao.getContainingDate as jest.MockedFunction<typeof BudgetDao.getContainingDate>;
const statusMock = BudgetRolloverDao.status as jest.MockedFunction<typeof BudgetRolloverDao.status>;
const saveMock = BudgetRolloverDao.save as jest.MockedFunction<typeof BudgetRolloverDao.save>;
const toast = SparkToast.show as jest.MockedFunction<typeof SparkToast.show>;

beforeEach(() => {
  jest.clearAllMocks();
  // Tarihe duyarlı: geri alma akışı kaynak ve hedefi ayrı ayrı okur.
  getContainingDate.mockImplementation(async (date: string) => (date >= '2026-09-01' ? budget({}) : source));
  saveMock.mockResolvedValue(undefined);
  statusMock.mockImplementation(async (b) => (b.id === 1
    ? status({ periodRemaining: 20, unallocated: 20 })
    : status({ periodRemaining: 800 })));
});

it('kaynak dönemin devredilebilir tutarını önerir ve girilen toplamı kaydeder', async () => {
  const screen = await render(<BudgetRolloverSection budget={budget({})} />);

  await fireEvent.press(screen.getByTestId('rollover-toggle'));
  await waitFor(() => expect(screen.getByTestId('rollover-amount')).toBeTruthy());
  // Öneri, kaynak dönemin henüz devredilmemiş kalanıdır; kullanıcı düşürebilir.
  expect(screen.getByTestId('rollover-amount').props.value).toBe('20.00');

  await act(async () => { fireEvent.changeText(screen.getByTestId('rollover-amount'), '15'); });
  await act(async () => { fireEvent.press(screen.getByTestId('rollover-save')); });

  await waitFor(() => expect(saveMock).toHaveBeenCalledWith(1, 2, 15));
  expect(mockTriggerRefresh).toHaveBeenCalledTimes(1);
  expect(toast).toHaveBeenCalledWith('rollover_saved', 'success');
});

it('geçersiz tutarda DAO çağrılmaz; DAO alan hatası kullanıcı mesajına dönüşür', async () => {
  const screen = await render(<BudgetRolloverSection budget={budget({})} />);
  await fireEvent.press(screen.getByTestId('rollover-toggle'));
  await waitFor(() => expect(screen.getByTestId('rollover-amount')).toBeTruthy());

  await act(async () => { fireEvent.changeText(screen.getByTestId('rollover-amount'), '0'); });
  await act(async () => { fireEvent.press(screen.getByTestId('rollover-save')); });
  await waitFor(() => expect(toast).toHaveBeenCalledWith('rollover_invalid_amount', 'error'));
  expect(saveMock).not.toHaveBeenCalled();

  saveMock.mockRejectedValueOnce(new Error('rollover_invalid_amount'));
  await act(async () => { fireEvent.changeText(screen.getByTestId('rollover-amount'), '25'); });
  await act(async () => { fireEvent.press(screen.getByTestId('rollover-save')); });

  await waitFor(() => expect(saveMock).toHaveBeenCalledWith(1, 2, 25));
  await waitFor(() => expect(toast).toHaveBeenLastCalledWith('rollover_invalid_amount', 'error'));
  expect(mockTriggerRefresh).not.toHaveBeenCalled();
});

it('kaynak kalanı devri artık desteklemiyorsa uyarıyı gösterir, tutarı sessizce değiştirmez', async () => {
  statusMock.mockImplementation(async (b) => (b.id === 1
    ? status({ periodRemaining: 10, unallocated: -10, outgoing: 20, needsReview: true, records: [record] })
    : status({ incoming: 20, periodRemaining: 820, needsReview: true, records: [record] })));

  const screen = await render(<BudgetRolloverSection budget={budget({})} />);

  await waitFor(() => expect(screen.getByText('rollover_review')).toBeTruthy());
  expect(screen.getByText('rollover_review').props.accessibilityRole).toBe('alert');
  expect(saveMock).not.toHaveBeenCalled();
});

it('mevcut devri onay sonrası sıfırlayarak geri alır', async () => {
  statusMock.mockImplementation(async (b) => (b.id === 1
    ? status({ periodRemaining: 20, outgoing: 20, unallocated: 0, records: [record] })
    : status({ incoming: 20, periodRemaining: 820, records: [record] })));

  const screen = await render(<BudgetRolloverSection budget={budget({})} />);

  await fireEvent.press(screen.getByTestId('rollover-toggle'));
  await waitFor(() => expect(screen.getByTestId('rollover-reverse-u-1')).toBeTruthy());
  await act(async () => { fireEvent.press(screen.getByTestId('rollover-reverse-u-1')); });
  await act(async () => { fireEvent.press(screen.getByTestId('rollover-reverse-confirm')); });

  await waitFor(() => expect(saveMock).toHaveBeenCalledWith(1, 2, 0));
  expect(toast).toHaveBeenCalledWith('rollover_saved', 'success');
});

it('geçmiş dönemde aktarım formu açılmaz', async () => {
  const past = await render(<BudgetRolloverSection budget={budget({ id: 1, period_start: '2026-08-01', period_end: '2026-08-31' })} />);

  await fireEvent.press(past.getByTestId('rollover-toggle'));
  await waitFor(() => expect(past.getByText('rollover_unavailable')).toBeTruthy());
  expect(past.queryByTestId('rollover-amount')).toBeNull();
});

it('bitişik kaynak dönem yoksa aktarım formu açılmaz', async () => {
  getContainingDate.mockResolvedValue(null);

  const orphan = await render(<BudgetRolloverSection budget={budget({})} />);

  await fireEvent.press(orphan.getByTestId('rollover-toggle'));
  await waitFor(() => expect(orphan.getByText('rollover_unavailable')).toBeTruthy());
  expect(orphan.queryByTestId('rollover-amount')).toBeNull();
});

 it('starts compact, hides closed controls, and retains the draft across disclosure toggles', async () => {
  const screen = await render(<BudgetRolloverSection budget={budget({})} />);
  expect(screen.getByTestId('rollover-toggle').props.accessibilityState.expanded).toBe(false);
  expect(screen.queryByTestId('rollover-amount')).toBeNull();
  await fireEvent.press(screen.getByTestId('rollover-toggle'));
  await waitFor(() => expect(screen.getByTestId('rollover-amount')).toBeTruthy());
  await fireEvent.changeText(screen.getByTestId('rollover-amount'), '12');
  await fireEvent.press(screen.getByTestId('rollover-toggle'));
  expect(screen.queryByTestId('rollover-save')).toBeNull();
  await fireEvent.press(screen.getByTestId('rollover-toggle'));
  expect(screen.getByTestId('rollover-amount').props.value).toBe('12');
  expect(saveMock).not.toHaveBeenCalled();
});
