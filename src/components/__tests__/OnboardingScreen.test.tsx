import React from 'react';
import { fireEvent, render, waitFor } from '@testing-library/react-native';

import OnboardingScreen from '../../../app/onboarding';
import { BudgetDao } from '../../db/budgetDao';

const mockSetLanguage = jest.fn(async () => undefined);
const mockSetCurrency = jest.fn(async () => undefined);
const mockSetOnboardingCompleted = jest.fn(async () => undefined);
const mockReplace = jest.fn();

jest.mock('expo-router', () => ({
  useRouter: () => ({ replace: mockReplace }),
}));

jest.mock('react-native-safe-area-context', () => {
  const React = require('react');
  const { View } = require('react-native');
  return {
    SafeAreaView: ({ children, ...props }: any) => React.createElement(View, props, children),
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
    FadeInUp: entering,
    ZoomIn: entering,
  };
});

jest.mock('@expo/vector-icons', () => {
  const React = require('react');
  const { Text } = require('react-native');
  return {
    MaterialCommunityIcons: ({ name }: { name: string }) => React.createElement(Text, null, name),
  };
});

jest.mock('../../theme/themeStore', () => ({
  useAppTheme: () => 'dark',
  useThemeRevision: () => 0,
}));

jest.mock('../../i18n/LanguageContext', () => ({
  useLanguage: () => ({
    t: (key: string) => key,
    language: 'tr',
    setLanguage: mockSetLanguage,
  }),
}));

jest.mock('../../context/CurrencyContext', () => ({
  useCurrency: () => ({ setCurrency: mockSetCurrency }),
  DISPLAY_CURRENCIES: ['AZN', 'USD', 'TRY', 'EUR', 'PLN'],
}));

jest.mock('../../context/NotificationsContext', () => ({
  useNotifications: () => ({ sync: jest.fn(async () => undefined) }),
}));

jest.mock('../../hooks/useOnboardingStatus', () => ({
  useOnboardingStatus: () => ({ setOnboardingCompleted: mockSetOnboardingCompleted }),
}));

jest.mock('../../db/budgetDao', () => ({
  BudgetDao: { setBudgetForPeriod: jest.fn().mockResolvedValue(1) },
}));

jest.mock('../../services/budgetCycleSettings', () => ({
  getCycleStartDay: jest.fn().mockResolvedValue(23),
}));

describe('OnboardingScreen ilk kurulum sırası', () => {
  beforeEach(() => jest.clearAllMocks());

  it('ilk sayfada dil seçimini gösterir', async () => {
    const screen = await render(<OnboardingScreen />);

    // Kullanıcı anlamadığı bir dilde karşılama metni okumak zorunda kalmamalı:
    // dil seçimi bütün tanıtım içeriğinden önce gelir.
    const pages = screen.getAllByTestId(/^onboarding-page-/);
    expect(pages.map((page) => page.props.testID)).toEqual([
      'onboarding-page-language',
      'onboarding-page-welcome',
      'onboarding-page-budget',
      'onboarding-page-done',
    ]);
    expect(screen.getByText('onboarding_language_title')).toBeTruthy();
  });

  it('dil seçimini anında uygular', async () => {
    const screen = await render(<OnboardingScreen />);

    await fireEvent.press(screen.getByText('English'));

    await waitFor(() => expect(mockSetLanguage).toHaveBeenCalledWith('en'));
  });

  it('ilk sayfada ileri, karşılama sayfasında başlangıç eylemini gösterir', async () => {
    const screen = await render(<OnboardingScreen />);

    // Dil sayfasında eylem nötr "ileri"dir; başlangıç daveti karşılama sayfasına aittir.
    expect(screen.getByText('onboarding_next')).toBeTruthy();

    await fireEvent.press(screen.getByText('onboarding_next'));

    await waitFor(() => expect(screen.getByText('onboarding_welcome_cta')).toBeTruthy());
  });

  it('bütçeyi kayıtlı döngü gününün dönemine yazar', async () => {
    const screen = await render(<OnboardingScreen />);

    await fireEvent.changeText(
      screen.getByPlaceholderText('onboarding_budget_input_placeholder'),
      '3450',
    );
    await fireEvent.press(screen.getByText('onboarding_done_explore_link'));

    await waitFor(() => expect(BudgetDao.setBudgetForPeriod).toHaveBeenCalledTimes(1));
    const written = (BudgetDao.setBudgetForPeriod as jest.Mock).mock.calls[0][0];
    expect(written.amount).toBe(3450);
    // Varsayılan 1 sabitlenmemeli; kayıtlı döngü günü kullanılmalı.
    expect(written.cycleStartDay).toBe(23);
    expect(mockSetOnboardingCompleted).toHaveBeenCalledWith(true);
  });
});
