import React from 'react';
import { fireEvent, render } from '@testing-library/react-native';
import DashboardCashEntryTiles from '../DashboardCashEntryTiles';

jest.mock('../../i18n/LanguageContext', () => ({
  useLanguage: () => ({ t: (key: string) => key }),
}));

describe('DashboardCashEntryTiles', () => {
  it('replaces ambiguous dashes with concise debt and income empty states', async () => {
    const screen = await render(
      <DashboardCashEntryTiles
        outstandingDebt={0}
        extraIncomeIn={0}
        currency="PLN"
        onDebtPress={jest.fn()}
        onIncomePress={jest.fn()}
      />,
    );

    expect(screen.getByText('debt_tile_empty')).toBeTruthy();
    expect(screen.getByText('income_tile_empty')).toBeTruthy();
    expect(screen.queryByText('—')).toBeNull();
  });

  it('shows the financial meaning of existing debt and period income', async () => {
    const screen = await render(
      <DashboardCashEntryTiles
        outstandingDebt={450}
        extraIncomeIn={125}
        currency="PLN"
        onDebtPress={jest.fn()}
        onIncomePress={jest.fn()}
      />,
    );

    expect(screen.getByText('debt_tile_balance_hint')).toBeTruthy();
    expect(screen.getByText('income_tile_applied_hint')).toBeTruthy();
    expect(screen.queryByText('debt_tile_empty')).toBeNull();
    expect(screen.queryByText('income_tile_empty')).toBeNull();
  });

  it('keeps both tiles actionable', async () => {
    const onDebtPress = jest.fn();
    const onIncomePress = jest.fn();
    const screen = await render(
      <DashboardCashEntryTiles
        outstandingDebt={0}
        extraIncomeIn={0}
        currency="PLN"
        onDebtPress={onDebtPress}
        onIncomePress={onIncomePress}
      />,
    );

    await fireEvent.press(screen.getByLabelText(/^debt_manage_cta/));
    await fireEvent.press(screen.getByLabelText(/^income_manage_cta/));
    expect(onDebtPress).toHaveBeenCalledTimes(1);
    expect(onIncomePress).toHaveBeenCalledTimes(1);
  });
});
