import React from 'react';
import { render, fireEvent, within } from '@testing-library/react-native';
import SpendingChangeCard from '../SpendingChangeCard';
import { buildSpendingChange } from '../../../utils/spendingChange';
import { getAnalyticsStyles } from '../analyticsStyles';
jest.mock('../../../theme/themeStore', () => ({ useAppTheme: () => 'dark', useThemeRevision: () => 0 }));
jest.mock('../../AnimatedCard', () => {
  const { View } = require('react-native');
  return ({ children }: any) => <View>{children}</View>;
});
jest.mock('../../SettingsInfoHint', () => ({ SettingsInfoHintModal: () => null, SettingsInfoIconButton: () => null }));
const base = { styles: getAnalyticsStyles(), t: (key: string) => key, tc: (key: string) => key, currency: 'PLN' as const };
it('keeps four categories per page and supports swipe and direct page selection', async () => {
  const data = buildSpendingChange([1,2,3,4,5,6].map(id => ({ category_id: id, category_name: `Group ${id}`, total: id })), []);
  const screen = await render(<SpendingChangeCard {...base} state={{ status: 'ready', data, ranges: null }} />);
  await fireEvent(screen.getByTestId('change-viewport'), 'layout', { nativeEvent: { layout: { width: 300 } } });
  expect(screen.getByTestId('spending-change-total')).toHaveTextContent(/21/);
  expect(within(screen.getByTestId('change-page-0')).getByText('Group 6')).toBeTruthy();
  expect(within(screen.getByTestId('change-page-0')).queryByText('Group 2')).toBeNull();
  expect(within(screen.getByTestId('change-page-1')).getByText('Group 2')).toBeTruthy();
  expect(screen.getByTestId('change-page-1')).toHaveStyle({ width: 300 });
  expect(screen.queryByText('spending_change_all')).toBeNull();
  await fireEvent(screen.getByTestId('change-pager'), 'momentumScrollEnd', { nativeEvent: { contentOffset: { x: 300 } } });
  expect(screen.getByTestId('change-page-button-1')).toHaveProp('accessibilityState', { selected: true });
  await fireEvent.press(screen.getByTestId('change-page-button-0'));
  expect(screen.getByTestId('change-page-button-0')).toHaveProp('accessibilityState', { selected: true });
  await screen.rerender(<SpendingChangeCard {...base} state={{ status: 'ready', data: buildSpendingChange([], []), ranges: null }} />);
  expect(screen.queryByTestId('change-page-button-1')).toBeNull();
  expect(screen.getByText('spending_change_unchanged')).toBeTruthy();
});
it('does not present a failed load as zero spending', async () => {
  const screen = await render(<SpendingChangeCard {...base} state={{ status: 'unavailable', data: buildSpendingChange([], []), ranges: null }} />);
  expect(screen.getByText('comparison_data_unavailable')).toBeTruthy();
  expect(screen.queryByTestId('spending-change-total')).toBeNull();
});
