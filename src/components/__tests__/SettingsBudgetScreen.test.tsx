import React from 'react';
import { fireEvent, render, waitFor } from '@testing-library/react-native';

import SettingsBudgetScreen from '../../../app/settings-budget';
import { BudgetDao } from '../../db/budgetDao';
import {
  getGoalFeaturePreferences,
  setGoalDashboardFocusEnabled,
} from '../../services/goalFeatureSettings';
import { SparkToast } from '../SparkToast';

const mockTriggerRefresh = jest.fn();
const mockSyncNotifications = jest.fn(async () => undefined);
const mockRouterPush = jest.fn();

jest.mock('expo-router', () => ({
  useRouter: () => ({ back: jest.fn(), push: mockRouterPush }),
}));

jest.mock('react-native-safe-area-context', () => {
  const React = require('react');
  const { View } = require('react-native');
  return {
    SafeAreaView: ({ children, ...props }: any) =>
      React.createElement(View, props, children),
  };
});

jest.mock('react-native-reanimated', () => {
  const React = require('react');
  const { View } = require('react-native');
  const entering: any = {};
  entering.delay = () => entering;
  entering.duration = () => entering;
  return {
    __esModule: true,
    default: {
      View: ({ children, ...props }: any) => React.createElement(View, props, children),
    },
    FadeInDown: entering,
  };
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
  impactAsync: jest.fn().mockResolvedValue(undefined),
  notificationAsync: jest.fn().mockResolvedValue(undefined),
  ImpactFeedbackStyle: { Light: 'light' },
  NotificationFeedbackType: { Success: 'success' },
}));

jest.mock('../../theme/themeStore', () => ({
  useAppTheme: () => 'dark',
  useThemeRevision: () => 0,
}));

jest.mock('../../i18n/LanguageContext', () => ({
  useLanguage: () => ({
    t: (key: string) => key,
  }),
}));

jest.mock('../../context/CurrencyContext', () => ({
  useCurrency: () => ({ currency: 'PLN' }),
}));

jest.mock('../../context/RefreshContext', () => ({
  useRefresh: () => ({ refreshKey: 0, triggerRefresh: mockTriggerRefresh }),
}));
jest.mock('../../context/NotificationsContext', () => ({
  useNotifications: () => ({ sync: mockSyncNotifications }),
}));

jest.mock('../../db/budgetDao', () => ({
  BudgetDao: {
    getForMonth: jest.fn().mockResolvedValue(null),
    setMonthlyBudget: jest.fn(),
    transitionAndSetBudget: jest.fn(),
    setBudgetForPeriod: jest.fn(),
    deleteBudget: jest.fn().mockResolvedValue(1),
  },
}));

jest.mock('../../services/budgetCycleSettings', () => ({
  getCycleStartDay: jest.fn().mockResolvedValue(1),
  setCycleStartDay: jest.fn(),
}));

jest.mock('../../services/goalFeatureSettings', () => ({
  getGoalFeaturePreferences: jest.fn(),
  setGoalDashboardFocusEnabled: jest.fn(),
  setGoalFeatureEnabled: jest.fn(),
}));

jest.mock('../GlassCheckButton', () => {
  const React = require('react');
  const { Pressable, Text } = require('react-native');
  return ({ onPress }: { onPress: () => void }) =>
    React.createElement(
      Pressable,
      { testID: 'budget-save', onPress },
      React.createElement(Text, null, 'save-budget'),
    );
});
jest.mock('../BudgetHistoryCard', () => () => null);
jest.mock('../GlassDeleteModal', () => {
  const React = require('react');
  const { Pressable, Text } = require('react-native');
  return ({ visible, onDelete }: any) => visible
    ? React.createElement(
        Pressable,
        { testID: 'budget-delete-confirm', onPress: onDelete },
        React.createElement(Text, null, 'confirm-delete'),
      )
    : null;
});
jest.mock('../SparkToast', () => ({ SparkToast: { show: jest.fn() } }));
jest.mock('../SettingsInfoHint', () => ({
  SettingsInfoHintModal: () => null,
  SettingsInfoIconButton: () => null,
}));

describe('SettingsBudgetScreen goal focus preference', () => {
  const getPreferences = getGoalFeaturePreferences as jest.MockedFunction<
    typeof getGoalFeaturePreferences
  >;
  const setDashboardFocus = setGoalDashboardFocusEnabled as jest.MockedFunction<
    typeof setGoalDashboardFocusEnabled
  >;

  beforeEach(() => {
    jest.clearAllMocks();
    setDashboardFocus.mockResolvedValue(undefined);
  });

  it('loads focus off and persists an explicit opt-in', async () => {
    getPreferences.mockResolvedValue({
      enabled: true,
      dashboardFocusEnabled: false,
    });

    const screen = await render(<SettingsBudgetScreen />);

    await waitFor(() => expect(getPreferences).toHaveBeenCalledTimes(1));
    await waitFor(() => {
      expect(screen.getByTestId('goal-focus-switch').props.value).toBe(false);
      expect(screen.getByTestId('goal-focus-switch').props.disabled).toBe(false);
    });

    await fireEvent(screen.getByTestId('goal-focus-switch'), 'valueChange', true);

    await waitFor(() => expect(setDashboardFocus).toHaveBeenCalledWith(true));
    expect(screen.getByTestId('goal-focus-switch').props.value).toBe(true);
    expect(mockTriggerRefresh).toHaveBeenCalledTimes(1);
  });

  it('disables the focus preference while the master goal feature is off', async () => {
    getPreferences.mockResolvedValue({
      enabled: false,
      dashboardFocusEnabled: true,
    });

    const screen = await render(<SettingsBudgetScreen />);

    await waitFor(() => {
      expect(screen.getByTestId('goal-feature-switch').props.value).toBe(false);
      expect(screen.getByTestId('goal-focus-switch').props.value).toBe(true);
      expect(screen.getByTestId('goal-focus-switch').props.disabled).toBe(true);
    });
    expect(setDashboardFocus).not.toHaveBeenCalled();
  });

  it('keeps planning rows concise and opens recurring payments from this group', async () => {
    getPreferences.mockResolvedValue({ enabled: true, dashboardFocusEnabled: false });

    const screen = await render(<SettingsBudgetScreen />);
    await waitFor(() => expect(getPreferences).toHaveBeenCalledTimes(1));

    expect(screen.queryByText('goal_focus_hint')).toBeNull();
    expect(screen.queryByText('goal_settings_month_hint')).toBeNull();
    expect(screen.getByText('subscriptions_title')).toBeTruthy();

    await fireEvent.press(screen.getByTestId('manage-recurring-payments'));
    expect(mockRouterPush).toHaveBeenCalledWith('/subscriptions');
  });

  it('keeps cycle steps as a draft and persists the transition only with budget save', async () => {
    getPreferences.mockResolvedValue({ enabled: true, dashboardFocusEnabled: false });
    (BudgetDao.getForMonth as jest.Mock).mockResolvedValue(null);
    (BudgetDao.transitionAndSetBudget as jest.Mock).mockResolvedValue(21);

    const screen = await render(<SettingsBudgetScreen />);
    await waitFor(() => expect(screen.getByText('budget_cycle_day_default')).toBeTruthy());

    await fireEvent.press(screen.getByText('plus'));
    expect(BudgetDao.transitionAndSetBudget).not.toHaveBeenCalled();

    await fireEvent.changeText(screen.getByPlaceholderText('5000'), '3600');
    await fireEvent.press(screen.getByTestId('budget-save'));

    await waitFor(() => expect(BudgetDao.transitionAndSetBudget).toHaveBeenCalledWith(
      expect.objectContaining({
        amount: 3600,
        currency: 'PLN',
        previousStartDay: 1,
        nextStartDay: 2,
      }),
    ));
    expect(mockSyncNotifications).toHaveBeenCalledTimes(1);
  });

  it('bütçe commit edildikten sonra bildirim senkronu reddetse de başarıyı korur', async () => {
    getPreferences.mockResolvedValue({ enabled: true, dashboardFocusEnabled: false });
    (BudgetDao.getForMonth as jest.Mock).mockResolvedValue(null);
    (BudgetDao.setMonthlyBudget as jest.Mock).mockResolvedValue(22);
    mockSyncNotifications.mockRejectedValueOnce(new Error('native inventory unavailable'));

    const screen = await render(<SettingsBudgetScreen />);
    await waitFor(() => expect(screen.getByText('budget_cycle_day_default')).toBeTruthy());
    await fireEvent.changeText(screen.getByPlaceholderText('5000'), '3600');
    await fireEvent.press(screen.getByTestId('budget-save'));

    await waitFor(() => expect(mockSyncNotifications).toHaveBeenCalledTimes(1));
    expect(BudgetDao.setMonthlyBudget).toHaveBeenCalled();
    expect(SparkToast.show).not.toHaveBeenCalledWith('error_saving_data', 'error');
  });
});

describe('SettingsBudgetScreen dönem sınırı ve bütçe silme', () => {
  const getPreferences = getGoalFeaturePreferences as jest.MockedFunction<
    typeof getGoalFeaturePreferences
  >;

  beforeEach(() => {
    jest.clearAllMocks();
    getPreferences.mockResolvedValue({ enabled: true, dashboardFocusEnabled: false });
    (BudgetDao.getForMonth as jest.Mock).mockResolvedValue(null);
  });

  it('başlamamış döneme geçişi kilitler ve gerekçesini gösterir', async () => {
    const screen = await render(<SettingsBudgetScreen />);
    await waitFor(() => expect(screen.getByText('budget_cycle_day_default')).toBeTruthy());

    // Açılışta mevcut dönem seçilidir: ileri ok kapalı, geri ok açıktır.
    expect(screen.getByTestId('budget-period-next').props.accessibilityState.disabled).toBe(true);
    expect(screen.getByTestId('budget-period-previous').props.accessibilityState.disabled).toBe(false);
    expect(screen.getByText('budget_future_locked')).toBeTruthy();
  });

  it('geriye yalnız mevcut dönem dahil 5 dönem gezdirir', async () => {
    const screen = await render(<SettingsBudgetScreen />);
    await waitFor(() => expect(screen.getByText('budget_cycle_day_default')).toBeTruthy());

    for (let step = 0; step < 4; step += 1) {
      await fireEvent.press(screen.getByTestId('budget-period-previous'));
    }
    // 4 adım sonra en eski düzenlenebilir döneme gelinir; geri ok kapanır.
    await waitFor(() =>
      expect(screen.getByTestId('budget-period-previous').props.accessibilityState.disabled).toBe(true),
    );
    // Geriye gidilebildiği için ileri ok yeniden açılmıştır.
    expect(screen.getByTestId('budget-period-next').props.accessibilityState.disabled).toBe(false);
  });

  it('kayıtlı bütçe yokken silme eylemini göstermez', async () => {
    const screen = await render(<SettingsBudgetScreen />);
    await waitFor(() => expect(screen.getByText('budget_cycle_day_default')).toBeTruthy());

    expect(screen.queryByTestId('budget-delete-action')).toBeNull();
  });

  it('onaydan sonra bütçe hedefini siler ve alanı temizler', async () => {
    (BudgetDao.getForMonth as jest.Mock).mockResolvedValue({
      id: 42,
      monthly_amount: 3450,
      currency: 'PLN',
      start_date: '2026-09',
      period_start: '2026-09-01',
      period_end: '2026-09-30',
      cycle_start_day: 1,
      active: 1,
    });

    const screen = await render(<SettingsBudgetScreen />);
    await waitFor(() => expect(screen.getByTestId('budget-delete-action')).toBeTruthy());
    expect(screen.getByPlaceholderText('5000').props.value).toBe('3450');

    await fireEvent.press(screen.getByTestId('budget-delete-action'));
    await fireEvent.press(screen.getByTestId('budget-delete-confirm'));

    await waitFor(() => expect(BudgetDao.deleteBudget).toHaveBeenCalledWith(42));
    expect(mockTriggerRefresh).toHaveBeenCalled();
    await waitFor(() => expect(screen.queryByTestId('budget-delete-action')).toBeNull());
  });
});
