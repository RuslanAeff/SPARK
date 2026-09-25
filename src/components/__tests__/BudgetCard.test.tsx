import React from 'react';
import { StyleSheet } from 'react-native';
import { render } from '@testing-library/react-native';
import BudgetCard from '../BudgetCard';
import { resolveTheme, setThemeSelectionReader } from '../../theme/colors';
import type { BudgetInfo } from '../../hooks/useBudget';

let mockScheme: 'light' | 'dark' = 'dark';
jest.mock('../../theme/themeStore', () => ({
  useAppTheme: () => mockScheme,
  useThemeRevision: () => mockScheme === 'dark' ? 1 : 2,
}));
jest.mock('../../i18n/LanguageContext', () => ({ useLanguage: () => ({ t: (key: string) => key }) }));
jest.mock('../../context/CurrencyContext', () => ({ useCurrency: () => ({ currency: 'PLN' }) }));
jest.mock('../AnimatedCard', () => {
  const React = require('react');
  const { View } = require('react-native');
  return ({ children }: any) => React.createElement(View, null, children);
});
jest.mock('@expo/vector-icons', () => ({ MaterialCommunityIcons: () => null }));

const budget: BudgetInfo = {
  monthlyBudget: 100, totalSpent: 20, remaining: 100, percentage: 17,
  dailyAverage: 2, dailyBudget: 10, daysRemaining: 10, isOverBudget: false,
  currency: 'PLN', periodStart: '2026-09-01', periodEnd: '2026-09-30', cycleStartDay: 1,
  borrowedIn: 0, repaidIn: 0, netDebtFlow: 0, extraIncomeIn: 0,
  effectiveBudget: 120, outstandingDebt: 0, carryIn: 20,
};

it('keeps the rollover amount readable when switching between dark and light themes', async () => {
  setThemeSelectionReader(() => ({ scheme: mockScheme, accent: 'green' }));
  mockScheme = 'dark';
  const screen = await render(<BudgetCard budget={budget} />);
  expect(StyleSheet.flatten(screen.getByText(/^\+/).props.style).color).toBe(resolveTheme('dark').textPrimary);
  mockScheme = 'light';
  await screen.rerender(<BudgetCard budget={{ ...budget }} />);
  expect(StyleSheet.flatten(screen.getByText(/^\+/).props.style).color).toBe(resolveTheme('light').textPrimary);
});

it('only shows rollover context when there is an amount or a review warning', async () => {
  const screen = await render(<BudgetCard budget={{ ...budget, carryIn: 0 }} />);
  expect(screen.queryByText('rollover_in')).toBeNull();
  await screen.rerender(<BudgetCard budget={{ ...budget, carryIn: 0, rolloverNeedsReview: true }} />);
  expect(screen.getByText('rollover_review')).toBeTruthy();
});
