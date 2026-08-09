import React from 'react';
import { fireEvent, render, waitFor } from '@testing-library/react-native';

import SettingsBudgetScreen from '../../../app/settings-budget';
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
  impactAsync: jest.fn(),
  notificationAsync: jest.fn(),
  ImpactFeedbackStyle: { Light: 'light' },
  NotificationFeedbackType: { Success: 'success' },
}));

jest.mock('../../theme/themeStore', () => ({
  useAppTheme: () => 'dark',
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

jest.mock('../GlassCheckButton', () => () => null);
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
});
