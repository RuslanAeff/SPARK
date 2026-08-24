import React from 'react';
import { fireEvent, render } from '@testing-library/react-native';

import SavingsGoalCard from '../SavingsGoalCard';

const mockImpactAsync = jest.fn().mockResolvedValue(undefined);

jest.mock('../../theme/themeStore', () => ({
  useAppTheme: () => 'dark',
  useThemeRevision: () => 0,
}));

jest.mock('../../context/CurrencyContext', () => ({
  useCurrency: () => ({ currency: 'PLN' }),
}));

jest.mock('../../i18n/LanguageContext', () => ({
  useLanguage: () => ({
    t: (key: string, params: Record<string, string> = {}) => ({
      savings_goal_kicker: 'Birikim hedefim',
      savings_goal_untitled: 'Hedef',
      savings_goal_remaining: 'Kalan',
      savings_goal_surplus: 'Fazla',
      savings_goal_target_date: 'Hedef tarih',
      savings_goal_days_left: `${params.days} gün kaldı`,
      savings_goal_days_passed: `${params.days} gün geçti`,
      savings_goal_deadline_today: 'Son gün bugün',
      savings_goal_monthly_need: `Aylık ${params.amount} biriktir`,
      goal_open_settings: 'Hedefi düzenle',
      goal_update_savings: 'Birikimi güncelle',
      goal_update_savings_hint: 'Tutar ekle veya azalt',
    })[key] ?? key,
  }),
}));

jest.mock('expo-router', () => ({
  useRouter: () => ({ push: jest.fn() }),
}));

jest.mock('expo-haptics', () => ({
  impactAsync: (...args: unknown[]) => mockImpactAsync(...args),
  ImpactFeedbackStyle: { Light: 'light' },
}));

jest.mock('@expo/vector-icons', () => {
  const ReactLocal = require('react');
  const { Text } = require('react-native');
  return {
    MaterialCommunityIcons: ({ name }: { name: string }) =>
      ReactLocal.createElement(Text, { testID: `icon-${name}` }, name),
  };
});

jest.mock('../AnimatedCard', () => {
  const ReactLocal = require('react');
  const { View } = require('react-native');
  return ({ children }: { children: React.ReactNode }) =>
    ReactLocal.createElement(View, null, children);
});

jest.mock('../SavingsGoalContributionSheet', () => {
  const ReactLocal = require('react');
  const { View } = require('react-native');
  return ({ visible }: { visible: boolean }) => visible
    ? ReactLocal.createElement(View, { testID: 'mock-contribution-sheet' })
    : null;
});

describe('SavingsGoalCard', () => {
  it('birikim güncelleme sonucunu CTA metni, alt açıklama ve çift yönlü ikonla anlatır', async () => {
    const screen = await render(
      <SavingsGoalCard
        goal={{
          id: 1,
          title: 'GTA VI',
          target_amount: 450,
          current_amount: 48,
          target_date: '2099-11-19',
          currency: 'PLN',
        }}
      />,
    );

    expect(screen.getByText('Birikimi güncelle')).toBeTruthy();
    expect(screen.getByText('Tutar ekle veya azalt')).toBeTruthy();
    expect(screen.getByTestId('icon-plus-minus-variant')).toBeTruthy();

    const updateButton = screen.getByTestId('goal-update-savings');
    expect(updateButton.props.accessibilityLabel).toBe('Birikimi güncelle');
    expect(updateButton.props.accessibilityHint).toBe('Tutar ekle veya azalt');
    expect(screen.queryByTestId('mock-contribution-sheet')).toBeNull();

    await fireEvent.press(updateButton);
    expect(screen.getByTestId('mock-contribution-sheet')).toBeTruthy();
  });
});
