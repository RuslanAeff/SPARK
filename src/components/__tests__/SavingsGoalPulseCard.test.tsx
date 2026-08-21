import React from 'react';
import { fireEvent, render } from '@testing-library/react-native';
import { StyleSheet } from 'react-native';

import SavingsGoalPulseCard from '../SavingsGoalPulseCard';

jest.mock('../../theme/themeStore', () => ({
  useAppTheme: () => 'dark',
  useThemeRevision: () => 0,
}));

jest.mock('../../context/CurrencyContext', () => ({
  useCurrency: () => ({ currency: 'PLN' }),
}));

jest.mock('../../i18n/LanguageContext', () => ({
  useLanguage: () => ({
    t: (key: string, params: Record<string, string> = {}) => {
      switch (key) {
        case 'savings_goal_kicker':
          return 'My savings goal';
        case 'savings_goal_untitled':
          return 'Goal';
        case 'savings_goal_days_left':
          return `${params.days} days left`;
        case 'savings_goal_days_passed':
          return `${params.days} days overdue`;
        case 'savings_goal_deadline_today':
          return 'Due today';
        case 'goal_focus_reached':
          return 'Goal reached';
        case 'goal_focus_remaining':
          return `${params.amount} remaining`;
        case 'goal_focus_a11y':
          return [params.title, `${params.percent}%`, params.saved, params.target, params.status]
            .join('; ');
        case 'goal_focus_open_hint':
          return 'Opens goal details';
        case 'goal_add_contribution':
          return 'Add contribution';
        default:
          return key;
      }
    },
  }),
}));

jest.mock('@expo/vector-icons', () => {
  const React = require('react');
  const { Text } = require('react-native');
  return {
    MaterialCommunityIcons: ({ name }: { name: string }) =>
      React.createElement(Text, { testID: `icon-${name}` }, name),
  };
});

jest.mock('../AnimatedCard', () => {
  const React = require('react');
  const { View } = require('react-native');
  return ({ children }: { children: React.ReactNode }) =>
    React.createElement(View, null, children);
});

const baseGoal = {
  id: 1,
  title: 'Emergency fund',
  target_amount: 1000,
  target_date: '2026-08-20',
  currency: 'PLN',
  current_amount: 0,
};

describe('SavingsGoalPulseCard', () => {
  it('renders an active goal with a truthful 0% bar and a complete accessibility label', async () => {
    const screen = await render(
      <SavingsGoalPulseCard
        goal={baseGoal}
        now={new Date(2026, 7, 10, 12)}
        onOpen={jest.fn()}
        onContribute={jest.fn()}
      />,
    );

    expect(screen.getByText('Emergency fund')).toBeTruthy();
    expect(screen.getByText('0%')).toBeTruthy();
    expect(screen.getByText(/10 days left/)).toBeTruthy();
    expect(
      StyleSheet.flatten(screen.getByTestId('goal-pulse-progress').props.style).width,
    ).toBe('0%');

    const mainButton = screen.getByTestId('goal-pulse-open');
    expect(mainButton.props.accessibilityRole).toBe('button');
    expect(mainButton.props.accessibilityHint).toBe('Opens goal details');
    expect(mainButton.props.accessibilityLabel).toContain('Emergency fund');
    expect(mainButton.props.accessibilityLabel).toContain('0%');
    expect(mainButton.props.accessibilityLabel).toContain('1 000,00 zł');
    expect(mainButton.props.accessibilityLabel).toContain('10 days left');
  });

  it('keeps the main-card and contribution actions independent', async () => {
    const onOpen = jest.fn();
    const onContribute = jest.fn();
    const screen = await render(
      <SavingsGoalPulseCard
        goal={{ ...baseGoal, current_amount: 250 }}
        now={new Date(2026, 7, 10, 12)}
        onOpen={onOpen}
        onContribute={onContribute}
      />,
    );

    await fireEvent.press(screen.getByTestId('goal-pulse-open'));
    expect(onOpen).toHaveBeenCalledTimes(1);
    expect(onContribute).not.toHaveBeenCalled();

    await fireEvent.press(screen.getByTestId('goal-pulse-contribute'));
    expect(onContribute).toHaveBeenCalledTimes(1);
    expect(onOpen).toHaveBeenCalledTimes(1);
    expect(screen.getByTestId('goal-pulse-contribute').props.accessibilityLabel)
      .toBe('Add contribution');
  });

  it('renders an overdue goal with explicit warning text and icon', async () => {
    const screen = await render(
      <SavingsGoalPulseCard
        goal={{ ...baseGoal, current_amount: 250, target_date: '2026-08-08' }}
        now={new Date(2026, 7, 10, 12)}
        onOpen={jest.fn()}
        onContribute={jest.fn()}
      />,
    );

    expect(screen.getByText(/2 days overdue/)).toBeTruthy();
    expect(screen.getByTestId('icon-alert-circle-outline')).toBeTruthy();
    expect(screen.getByTestId('goal-pulse-open').props.accessibilityLabel)
      .toContain('2 days overdue');
  });
});
