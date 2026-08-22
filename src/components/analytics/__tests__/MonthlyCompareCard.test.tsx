// react-native-reanimated → __mocks__/react-native-reanimated.js (otomatik)
import React from 'react';
import { render } from '@testing-library/react-native';
import MonthlyCompareCard from '../MonthlyCompareCard';
import { getAnalyticsStyles } from '../analyticsStyles';

const base = { styles: getAnalyticsStyles(), t: (k: string) => k, tc: (k: string) => k, currency: 'PLN' as const };
const ranges = {
  currentRange: { start: '2026-08-01', end: '2026-08-10' },
  previousRange: { start: '2026-07-01', end: '2026-07-10' },
};

describe('MonthlyCompareCard', () => {
  it('timeframe "year" ise hiçbir şey render etmez (null)', async () => {
    const { toJSON } = await render(
      <MonthlyCompareCard {...base} {...ranges} status="ready" timeframe="year" currentTotal={100} prevTotal={80} comparisonDelta={25} />
    );
    expect(toJSON()).toBeNull();
  });

  it('bu/önceki dönem ve artış rozetini gösterir', async () => {
    const { getByText } = await render(
      <MonthlyCompareCard {...base} {...ranges} status="ready" timeframe="month" currentTotal={100} prevTotal={80} comparisonDelta={25} />
    );
    expect(getByText('monthly_comparison')).toBeTruthy();
    expect(getByText('increased_pct')).toBeTruthy(); // delta > 0 → artış metni
    expect(getByText('01.08.2026 – 10.08.2026')).toBeTruthy();
    expect(getByText('01.07.2026 – 10.07.2026')).toBeTruthy();
  });

  it('önceki eş aralık sıfırsa bunu veri hatası gibi göstermez', async () => {
    const { getByText } = await render(
      <MonthlyCompareCard {...base} {...ranges} status="ready" timeframe="month" currentTotal={100} prevTotal={0} comparisonDelta={null} />
    );
    expect(getByText('comparison_previous_zero')).toBeTruthy();
  });

  it('sorgu hatasıyla tamamlanmış gün yok durumunu ayrı gösterir', async () => {
    const unavailable = await render(
      <MonthlyCompareCard {...base} status="unavailable" timeframe="month" currentTotal={0} prevTotal={0} comparisonDelta={null} currentRange={null} previousRange={null} />
    );
    expect(unavailable.getByText('comparison_data_unavailable')).toBeTruthy();
    await unavailable.unmount();

    const noDays = await render(
      <MonthlyCompareCard {...base} status="no_completed_days" timeframe="month" currentTotal={0} prevTotal={0} comparisonDelta={null} currentRange={null} previousRange={null} />
    );
    expect(noDays.getByText('comparison_no_completed_days')).toBeTruthy();
  });
});
