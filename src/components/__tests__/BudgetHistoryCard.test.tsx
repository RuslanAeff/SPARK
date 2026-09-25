import React from 'react';
import { fireEvent, render, waitFor, within } from '@testing-library/react-native';
import BudgetHistoryCard from '../BudgetHistoryCard';

const mockGetAllBudgets = jest.fn();
jest.mock('../../db/budgetDao', () => ({ BudgetDao: { getAllBudgets: (...args: unknown[]) => mockGetAllBudgets(...args) } }));
jest.mock('../../db/expenseDao', () => ({ ExpenseDao: {
  getMonthsWithSpending: jest.fn(async () => []), getTotalByDateRange: jest.fn(async () => 0),
} }));
jest.mock('../../db/budgetRolloverDao', () => ({ BudgetRolloverDao: { list: jest.fn(async () => []) } }));
jest.mock('../../db/debtDao', () => ({ DebtDao: {
  getBorrowedTotalByDateRange: jest.fn(async () => 0), getRepaidTotalByDateRange: jest.fn(async () => 0),
} }));
jest.mock('../../db/incomeDao', () => ({ IncomeDao: { getTotalByDateRange: jest.fn(async () => 0) } }));
jest.mock('../../services/budgetCycleSettings', () => ({ getCycleStartDay: jest.fn(async () => 23) }));
jest.mock('../../utils/dateUtils', () => ({ getToday: () => '2026-09-25', formatDayMonth: (v: string) => v }));
jest.mock('../../theme/themeStore', () => ({ useAppTheme: () => 'dark', useThemeRevision: () => 0 }));
jest.mock('../../i18n/LanguageContext', () => ({ useLanguage: () => ({ t: (key: string) => key }) }));
jest.mock('../../context/CurrencyContext', () => ({ useCurrency: () => ({ currency: 'PLN' }) }));
jest.mock('../../context/RefreshContext', () => ({ useRefresh: () => ({ refreshKey: 0 }) }));
jest.mock('@expo/vector-icons', () => {
  const React = require('react'); const { Text } = require('react-native');
  return { MaterialCommunityIcons: ({ name }: { name: string }) => React.createElement(Text, null, name) };
});

it('selects the exact budget id when two transitions start in the same calendar month', async () => {
  mockGetAllBudgets.mockResolvedValue([
    { id: 9, monthly_amount: 900, currency: 'PLN', start_date: '2026-08', period_start: '2026-08-21', period_end: '2026-09-20', cycle_start_day: 21, active: 1 },
    { id: 4, monthly_amount: 1000, currency: 'PLN', start_date: '2026-08', period_start: '2026-08-01', period_end: '2026-08-20', cycle_start_day: 1, active: 1 },
  ]);
  const onSelect = jest.fn();
  const screen = await render(<BudgetHistoryCard onSelectPeriod={onSelect} selectedBudgetId={9} />);
  await waitFor(() => expect(screen.getByTestId('budget-history-card-4')).toBeTruthy());

  fireEvent.press(screen.getByTestId('budget-history-card-4'));
  expect(onSelect).toHaveBeenCalledWith(expect.objectContaining({
    budget: expect.objectContaining({ id: 4 }),
    cycle: expect.objectContaining({ start: '2026-08-01', end: '2026-08-20' }),
  }));
  expect(screen.getByTestId('budget-history-card-4').props.accessibilityRole).toBe('button');
  expect(screen.getByTestId('budget-history-card-9').props.accessibilityState.selected).toBe(true);
  expect(screen.getByTestId('budget-history-card-4').props.accessibilityState.selected).toBe(false);
  // A shortened period beginning on day 1 must not masquerade as a full month.
  const card = within(screen.getByTestId('budget-history-card-4'));
  expect(card.getByText('2026-08-01 2026 – 2026-08-20 2026')).toBeTruthy();
  expect(card.getByText('rollover_base')).toBeTruthy();
  expect(card.getByText('spent_label')).toBeTruthy();
  expect(card.getByText('remaining_label')).toBeTruthy();
});
