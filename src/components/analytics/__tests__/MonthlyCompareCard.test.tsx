// react-native-reanimated → __mocks__/react-native-reanimated.js (otomatik)
import React from 'react';
import { render } from '@testing-library/react-native';
import MonthlyCompareCard from '../MonthlyCompareCard';
import { getAnalyticsStyles } from '../analyticsStyles';

const base = { styles: getAnalyticsStyles(), t: (k: string) => k, tc: (k: string) => k, currency: 'PLN' as const };

describe('MonthlyCompareCard', () => {
  it('timeframe "year" ise hiçbir şey render etmez (null)', async () => {
    const { toJSON } = await render(
      <MonthlyCompareCard {...base} timeframe="year" currentTotal={100} prevTotal={80} comparisonDelta={25} />
    );
    expect(toJSON()).toBeNull();
  });

  it('bu/önceki dönem ve artış rozetini gösterir', async () => {
    const { getByText } = await render(
      <MonthlyCompareCard {...base} timeframe="month" currentTotal={100} prevTotal={80} comparisonDelta={25} />
    );
    expect(getByText('monthly_comparison')).toBeTruthy();
    expect(getByText('increased_pct')).toBeTruthy(); // delta > 0 → artış metni
  });

  it('önceki veri yoksa "veri yok" durumunu gösterir', async () => {
    const { getByText } = await render(
      <MonthlyCompareCard {...base} timeframe="month" currentTotal={100} prevTotal={0} comparisonDelta={null} />
    );
    expect(getByText('no_previous_data')).toBeTruthy();
  });
});
