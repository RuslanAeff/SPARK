import React from 'react';
import { fireEvent, render, waitFor } from '@testing-library/react-native';

import SettingsBudgetScreen from '../../../app/settings-budget';
import { BudgetDao } from '../../db/budgetDao';
import {
  getGoalFeaturePreferences,
  setGoalDashboardFocusEnabled,
} from '../../services/goalFeatureSettings';

const mockTriggerRefresh = jest.fn();

jest.mock('expo-router', () => ({
  useRouter: () => ({ back: jest.fn(), push: jest.fn() }),
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

jest.mock('../../db/budgetDao', () => ({
  BudgetDao: {
    getForMonth: jest.fn().mockResolvedValue(null),
    setMonthlyBudget: jest.fn(),
    transitionAndSetBudget: jest.fn(),
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
  });
});
