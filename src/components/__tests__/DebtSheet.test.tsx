import React from 'react';
import { act, fireEvent, render, waitFor } from '@testing-library/react-native';

import DebtSheet from '../DebtSheet';
import { SparkToast } from '../SparkToast';
import { DebtDao } from '../../db/debtDao';
import { ExpenseDao } from '../../db/expenseDao';
import { Debt } from '../../db/schema';
import { getToday } from '../../utils/dateUtils';
import * as Haptics from 'expo-haptics';

const mockTriggerRefresh = jest.fn();

function getPressHandler(instance: any): () => Promise<void> {
  let node = instance;
  while (node) {
    if (typeof node.props?.onPress === 'function') return node.props.onPress;
    node = node.parent;
  }

  let fiber = instance.unstable_fiber;
  while (fiber) {
    if (typeof fiber.memoizedProps?.onPress === 'function') {
      return fiber.memoizedProps.onPress;
    }
    fiber = fiber.return;
  }
  throw new Error('Press handler not found');
}

jest.mock('../../db/debtDao', () => ({
  DebtDao: {
    create: jest.fn(),
    listOpen: jest.fn(),
    listAll: jest.fn(),
    getPayments: jest.fn(),
    updateReminderSettings: jest.fn(),
    repay: jest.fn(),
    remove: jest.fn(),
  },
}));

jest.mock('../../db/expenseDao', () => ({
  ExpenseDao: { getAll: jest.fn() },
}));

jest.mock('../../theme/themeStore', () => ({
  useAppTheme: () => 'light',
  useThemeRevision: () => 0,
}));

jest.mock('../../context/RefreshContext', () => ({
  useRefreshActions: () => ({ triggerRefresh: mockTriggerRefresh }),
}));

jest.mock('../../i18n/LanguageContext', () => ({
  useLanguage: () => ({
    t: (key: string, params?: Record<string, string | number>) => {
      if (!params) return key;
      return Object.entries(params).reduce(
        (text, [name, value]) => text.replace(`{${name}}`, String(value)),
        key,
      );
    },
  }),
}));

jest.mock('expo-haptics', () => ({
  notificationAsync: jest.fn(),
  NotificationFeedbackType: { Success: 'success' },
}));

jest.mock('@expo/vector-icons', () => {
  const React = require('react');
  const { Text } = require('react-native');
  return {
    MaterialCommunityIcons: ({ name }: { name: string }) =>
      React.createElement(Text, null, name),
  };
});

jest.mock('../SparkToast', () => ({
  SparkToast: { show: jest.fn() },
}));

jest.mock('../BottomSheetModal', () => {
  const React = require('react');
  const { View } = require('react-native');
  return ({ visible, children }: { visible: boolean; children: React.ReactNode }) =>
    visible ? React.createElement(View, null, children) : null;
});

jest.mock('../CustomDatePicker', () => {
  const React = require('react');
  const { Pressable, View } = require('react-native');
  return ({ visible, onClose, onSelectDate }: any) => {
    if (!visible) return null;
    const select = (date: string) => {
      onSelectDate(date);
      onClose();
    };
    return React.createElement(
      View,
      { testID: 'mock-date-picker' },
      React.createElement(Pressable, {
        testID: 'mock-select-transaction-date',
        onPress: () => select('2026-08-03'),
      }),
      React.createElement(Pressable, {
        testID: 'mock-select-due-date',
        onPress: () => select('2026-09-15'),
      }),
      React.createElement(Pressable, {
        testID: 'mock-select-updated-due-date',
        onPress: () => select('2026-10-20'),
      }),
    );
  };
});

jest.mock('../GlassDeleteModal', () => () => null);

const openDebt: Debt = {
  id: 41,
  direction: 'borrowed',
  counterparty: 'LandLord',
  amount: 2000,
  remaining: 1500,
  currency: 'PLN',
  date: '2026-08-01',
  status: 'open',
  due_date: '2026-09-15',
  reminder_enabled: 1,
  reminder_days_before: 7,
  reminder_time: '08:30',
  linked_expense_id: null,
  note: null,
  created_at: '2026-08-01T10:00:00.000Z',
};

describe('DebtSheet debt reminder flow', () => {
  const create = DebtDao.create as jest.MockedFunction<typeof DebtDao.create>;
  const listOpen = DebtDao.listOpen as jest.MockedFunction<typeof DebtDao.listOpen>;
  const listAll = DebtDao.listAll as jest.MockedFunction<typeof DebtDao.listAll>;
  const updateReminderSettings = DebtDao.updateReminderSettings as jest.MockedFunction<
    typeof DebtDao.updateReminderSettings
  >;
  const expenseGetAll = ExpenseDao.getAll as jest.MockedFunction<typeof ExpenseDao.getAll>;
  const toastShow = SparkToast.show as jest.MockedFunction<typeof SparkToast.show>;
  const haptic = Haptics.notificationAsync as jest.MockedFunction<
    typeof Haptics.notificationAsync
  >;

  beforeEach(() => {
    jest.clearAllMocks();
    listOpen.mockResolvedValue([]);
    listAll.mockResolvedValue([]);
    expenseGetAll.mockResolvedValue([]);
    create.mockResolvedValue(1);
    updateReminderSettings.mockResolvedValue(true);
    haptic.mockResolvedValue(undefined);
  });

  async function renderSheet(onChanged = jest.fn(async () => undefined)) {
    const screen = await render(
      <DebtSheet visible onClose={jest.fn()} currency="PLN" onChanged={onChanged} />,
    );
    await waitFor(() => expect(listOpen).toHaveBeenCalled());
    return { screen, onChanged };
  }

  async function openAddForm(screen: Awaited<ReturnType<typeof renderSheet>>['screen']) {
    await fireEvent.press(screen.getByText('debt_add_title'));
    await waitFor(() => expect(expenseGetAll).toHaveBeenCalled());
  }

  async function fillRequiredAddFields(
    screen: Awaited<ReturnType<typeof renderSheet>>['screen'],
    amount = '125,50',
    counterparty = 'Alice',
  ) {
    await fireEvent.changeText(screen.getByPlaceholderText('0.00'), amount);
    await fireEvent.changeText(screen.getByPlaceholderText('debt_counterparty_ph'), counterparty);
  }

  async function openExistingReminderSettings(
    screen: Awaited<ReturnType<typeof renderSheet>>['screen'],
  ) {
    await fireEvent.press(await screen.findByText(openDebt.counterparty));
    await fireEvent.press(screen.getByTestId('debt-open-reminder-settings'));
  }

  it('vadesiz borç oluştururken eski alanları korur ve hatırlatma alanlarını kapalı gönderir', async () => {
    const { screen } = await renderSheet();
    await openAddForm(screen);
    await fillRequiredAddFields(screen);

    await fireEvent.press(screen.getByText('save'));

    await waitFor(() => expect(create).toHaveBeenCalledTimes(1));
    expect(create).toHaveBeenCalledWith({
      direction: 'borrowed',
      counterparty: 'Alice',
      amount: 125.5,
      currency: 'PLN',
      date: getToday(),
      dueDate: null,
      reminderEnabled: false,
      reminderDaysBefore: undefined,
      reminderTime: undefined,
      note: null,
      linkedExpenseId: null,
    });
  });

  it('borç tarihi ile vade seçici hedeflerini karıştırmadan vade ve hatırlatmayı tek create çağrısına taşır', async () => {
    const { screen } = await renderSheet();
    await openAddForm(screen);
    await fillRequiredAddFields(screen, '200', 'Bob');

    await fireEvent.press(screen.getByTestId('debt-transaction-date-button'));
    await fireEvent.press(screen.getByTestId('mock-select-transaction-date'));
    await fireEvent.press(screen.getByTestId('debt-due-date-button'));
    await fireEvent.press(screen.getByTestId('mock-select-due-date'));
    await fireEvent(screen.getByTestId('debt-reminder-switch'), 'valueChange', true);
    await fireEvent.press(screen.getByTestId('debt-reminder-days-1'));

    await fireEvent.press(screen.getByText('save'));

    await waitFor(() => expect(create).toHaveBeenCalledTimes(1));
    expect(create).toHaveBeenCalledWith(expect.objectContaining({
      counterparty: 'Bob',
      amount: 200,
      date: '2026-08-03',
      dueDate: '2026-09-15',
      reminderEnabled: true,
      reminderDaysBefore: 1,
      reminderTime: '09:00',
    }));
  });

  it('mevcut açık borcun ayarlarını doldurur, vade ve zaman değişikliklerini exact update ile yazar', async () => {
    listOpen.mockResolvedValue([openDebt]);
    listAll.mockResolvedValue([openDebt]);
    const { screen } = await renderSheet();
    await openExistingReminderSettings(screen);

    expect(screen.getByTestId('debt-reminder-switch').props.value).toBe(true);
    expect(screen.getByTestId('debt-reminder-days-7').props.accessibilityState.selected).toBe(true);
    expect(screen.getByTestId('debt-reminder-hour-input').props.value).toBe('08');
    expect(screen.getByTestId('debt-reminder-minute-input').props.value).toBe('30');

    await fireEvent.press(screen.getByTestId('debt-due-date-button'));
    await fireEvent.press(screen.getByTestId('mock-select-updated-due-date'));
    await fireEvent.press(screen.getByTestId('debt-reminder-days-3'));
    await fireEvent.changeText(screen.getByTestId('debt-reminder-hour-input'), '07');
    await fireEvent.changeText(screen.getByTestId('debt-reminder-minute-input'), '45');
    await fireEvent.press(screen.getByTestId('debt-reminder-save'));

    await waitFor(() => expect(updateReminderSettings).toHaveBeenCalledTimes(1));
    expect(updateReminderSettings).toHaveBeenCalledWith(openDebt.id, {
      dueDate: '2026-10-20',
      reminderEnabled: true,
      reminderDaysBefore: 3,
      reminderTime: '07:45',
    });
    expect(mockTriggerRefresh).toHaveBeenCalledTimes(1);
  });

  it('mevcut vade silindiğinde hatırlatmayı kapatıp yalnız kapalı ayarı kaydeder', async () => {
    listOpen.mockResolvedValue([openDebt]);
    listAll.mockResolvedValue([openDebt]);
    const { screen } = await renderSheet();
    await openExistingReminderSettings(screen);

    await fireEvent.press(screen.getByTestId('debt-due-date-clear'));
    const toggle = screen.getByTestId('debt-reminder-switch');
    expect(toggle.props.value).toBe(false);
    expect(toggle.props.disabled).toBe(true);

    await fireEvent.press(screen.getByTestId('debt-reminder-save'));

    await waitFor(() => expect(updateReminderSettings).toHaveBeenCalledTimes(1));
    expect(updateReminderSettings).toHaveBeenCalledWith(openDebt.id, {
      dueDate: null,
      reminderEnabled: false,
      reminderDaysBefore: undefined,
      reminderTime: undefined,
    });
  });

  it('DAO false döndürdüğünde sahte başarı veya global yenileme üretmez', async () => {
    listOpen.mockResolvedValue([openDebt]);
    listAll.mockResolvedValue([openDebt]);
    updateReminderSettings.mockResolvedValue(false);
    const { screen, onChanged } = await renderSheet();
    await openExistingReminderSettings(screen);

    await fireEvent.press(screen.getByTestId('debt-reminder-save'));

    await waitFor(() => {
      expect(toastShow).toHaveBeenCalledWith('debt_reminder_unavailable', 'info');
    });
    expect(toastShow).not.toHaveBeenCalledWith('debt_reminder_saved_toast', 'success');
    expect(onChanged).not.toHaveBeenCalled();
    expect(mockTriggerRefresh).not.toHaveBeenCalled();
    expect(haptic).not.toHaveBeenCalled();
  });

  it('DAO yazısı beklerken hızlı çift kaydı tek create çağrısında birleştirir', async () => {
    let resolveWrite: (id: number) => void = () => undefined;
    create.mockReturnValue(new Promise<number>((resolve) => {
      resolveWrite = resolve;
    }));
    const { screen, onChanged } = await renderSheet();
    await openAddForm(screen);
    await fillRequiredAddFields(screen, '300', 'Carol');
    const pressSave = getPressHandler(screen.getByText('save'));

    await act(async () => {
      const first = pressSave();
      const duplicate = pressSave();
      expect(create).toHaveBeenCalledTimes(1);
      resolveWrite(99);
      await Promise.all([first, duplicate]);
    });

    expect(create).toHaveBeenCalledTimes(1);
    expect(toastShow).toHaveBeenCalledTimes(1);
    expect(onChanged).toHaveBeenCalledTimes(1);
  });
});
