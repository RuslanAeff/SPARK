import React from 'react';
import { act, fireEvent, render, waitFor } from '@testing-library/react-native';

import GoalSettingsScreen from '../../../app/goal-settings';
import { GoalDao } from '../../db/goalDao';
import { CategoryLimitDao } from '../../db/categoryLimitDao';
import { CategoryDao } from '../../db/categoryDao';
import { SparkToast } from '../SparkToast';

const mockBack = jest.fn();
const mockTriggerRefresh = jest.fn();

jest.mock('expo-router', () => ({
  useRouter: () => ({ back: mockBack }),
}));

jest.mock('react-native-safe-area-context', () => {
  const { View } = require('react-native');
  return { SafeAreaView: View };
});

jest.mock('@expo/vector-icons', () => {
  const React = require('react');
  const { Text } = require('react-native');
  return {
    MaterialCommunityIcons: ({ name }: { name: string }) =>
      React.createElement(Text, null, name),
  };
});

jest.mock('expo-haptics', () => ({
  impactAsync: jest.fn(),
  notificationAsync: jest.fn(),
  ImpactFeedbackStyle: { Light: 'light' },
  NotificationFeedbackType: { Success: 'success' },
}));

jest.mock('../../db/goalDao', () => ({
  GoalDao: {
    get: jest.fn(),
    upsert: jest.fn(),
    clear: jest.fn(),
  },
}));

jest.mock('../../db/categoryDao', () => ({ CategoryDao: { getAll: jest.fn() } }));

jest.mock('../../db/categoryLimitDao', () => ({
  CategoryLimitDao: {
    getForMonth: jest.fn(),
    getForMonthWithSpending: jest.fn(),
    upsert: jest.fn(),
    remove: jest.fn(),
    deleteAll: jest.fn(),
  },
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

jest.mock('../../context/RefreshContext', () => ({
  useRefreshActions: () => ({ triggerRefresh: mockTriggerRefresh }),
}));

jest.mock('../SparkToast', () => ({
  SparkToast: { show: jest.fn() },
}));

jest.mock('../CustomDatePicker', () => () => null);

jest.mock('../GlassDeleteModal', () => {
  const React = require('react');
  const { Pressable, Text, View } = require('react-native');
  return ({ visible, message, onDelete }: any) =>
    visible
      ? React.createElement(
          View,
          null,
          React.createElement(Text, null, message),
          React.createElement(Pressable, {
            testID: 'confirm-goal-delete',
            onPress: onDelete,
          }),
        )
      : null;
});

const goal = {
  id: 1,
  title: 'Emergency fund',
  target_amount: 1000,
  target_date: '2026-12-31',
  currency: 'PLN',
  current_amount: 250,
};

describe('GoalSettingsScreen goal deletion', () => {
  const goalGet = GoalDao.get as jest.MockedFunction<typeof GoalDao.get>;
  const goalClear = GoalDao.clear as jest.MockedFunction<typeof GoalDao.clear>;
  const goalUpsert = GoalDao.upsert as jest.MockedFunction<typeof GoalDao.upsert>;
  const getCategories = CategoryDao.getAll as jest.MockedFunction<typeof CategoryDao.getAll>;
  const getLimits = CategoryLimitDao.getForMonth as jest.MockedFunction<
    typeof CategoryLimitDao.getForMonth
  >;
  const deleteAllLimits = CategoryLimitDao.deleteAll as jest.MockedFunction<
    typeof CategoryLimitDao.deleteAll
  >;
  const toastShow = SparkToast.show as jest.MockedFunction<typeof SparkToast.show>;
  const upsertLimit = CategoryLimitDao.upsert as jest.MockedFunction<typeof CategoryLimitDao.upsert>;

  beforeEach(() => {
    jest.clearAllMocks();
    getLimits.mockResolvedValue([
      { id: 12, category_id: 7, month: '2026-08', limit_amount: 300 },
    ]);
    getCategories.mockResolvedValue([]);
  });

  it('does not expose a destructive action when no persisted goal exists', async () => {
    goalGet.mockResolvedValue(null);
    const screen = await render(<GoalSettingsScreen />);

    await waitFor(() => expect(goalGet).toHaveBeenCalledTimes(1));
    await act(async () => undefined);

    expect(screen.queryByTestId('goal-clear-button')).toBeNull();
    expect(goalClear).not.toHaveBeenCalled();
    expect(deleteAllLimits).not.toHaveBeenCalled();
  });

  it('removes only the persisted goal and keeps category limits', async () => {
    goalGet.mockResolvedValue(goal);
    goalClear.mockResolvedValue(true);
    const screen = await render(<GoalSettingsScreen />);

    await fireEvent.press(await screen.findByTestId('goal-clear-button'));
    await fireEvent.press(await screen.findByTestId('confirm-goal-delete'));

    await waitFor(() => expect(goalClear).toHaveBeenCalledTimes(1));
    expect(deleteAllLimits).not.toHaveBeenCalled();
    expect(toastShow).toHaveBeenCalledWith('goal_removed', 'success');
    expect(mockTriggerRefresh).toHaveBeenCalledTimes(1);
    expect(mockBack).toHaveBeenCalledTimes(1);
  });

  it('shows a logical warning instead of fake success for a stale goal', async () => {
    goalGet.mockResolvedValue(goal);
    goalClear.mockResolvedValue(false);
    const screen = await render(<GoalSettingsScreen />);

    await fireEvent.press(await screen.findByTestId('goal-clear-button'));
    await fireEvent.press(await screen.findByTestId('confirm-goal-delete'));

    await waitFor(() =>
      expect(toastShow).toHaveBeenCalledWith('goal_clear_missing', 'info'),
    );
    expect(deleteAllLimits).not.toHaveBeenCalled();
    expect(mockTriggerRefresh).not.toHaveBeenCalled();
    expect(mockBack).not.toHaveBeenCalled();
  });

  it('birikim hedefi olmadan yalnız kategori limiti kaydeder', async () => {
    goalGet.mockResolvedValue(null);
    getLimits.mockResolvedValue([]);
    getCategories.mockResolvedValue([
      { id: 7, name: 'Market', icon: 'cart-outline', color: '#00FF66', parent_id: null },
    ] as any);
    const screen = await render(<GoalSettingsScreen />);

    await act(async () => {
      fireEvent.press(await screen.findByText('goal_settings_add_limit'));
    });
    await act(async () => {
      fireEvent.press(await screen.findByText('Market'));
    });
    await act(async () => {
      fireEvent.press(screen.getByTestId('goal-settings-save'));
    });

    await waitFor(() => expect(upsertLimit).toHaveBeenCalledWith(7, expect.any(String), 100));
    expect(goalUpsert).not.toHaveBeenCalled();
  });
});
