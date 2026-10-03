// react-native-reanimated → __mocks__/react-native-reanimated.js (otomatik)
import React from 'react';
import { render } from '@testing-library/react-native';
import ProjectionCard from '../ProjectionCard';
import { getAnalyticsStyles } from '../analyticsStyles';
import { formatCurrency } from '../../../utils/formatCurrency';
import type { ProjectionInfo } from '../shared';

const base = {
  styles: getAnalyticsStyles(),
  t: (key: string) => key,
  tc: (key: string) => key,
  currency: 'PLN' as const,
};

describe('ProjectionCard', () => {
  it('yıllık görünümde hiçbir şey render etmez', async () => {
    const { toJSON } = await render(
      <ProjectionCard
        {...base}
        timeframe="year"
        projectionInfo={{ available: false, reason: 'only_month' }}
      />,
    );

    expect(toJSON()).toBeNull();
  });

  it('haftalık görünümde aylık projeksiyon açıklamasını korur', async () => {
    const { getByText } = await render(
      <ProjectionCard
        {...base}
        timeframe="week"
        projectionInfo={{ available: false, reason: 'only_month' }}
      />,
    );

    expect(getByText('projection_title')).toBeTruthy();
    expect(getByText('projection_only_month')).toBeTruthy();
  });

  it('aylık görünümde mevcut projeksiyonu render eder', async () => {
    const projectionInfo: ProjectionInfo = {
      available: true,
      projected: 900,
      currentSpent: 600,
      dailyPace: 30,
      naiveDailyPace: 30,
      daysLeft: 10,
      effectiveBudget: 1200,
      status: 'safe',
      deltaPct: -25,
      hasOutlier: false,
      periodLabel: null,
      isCycle: false,
    };

    const { getByText, queryByTestId } = await render(
      <ProjectionCard {...base} timeframe="month" projectionInfo={projectionInfo} />,
    );

    expect(getByText('projection_title')).toBeTruthy();
    expect(getByText('projection_estimated')).toBeTruthy();
    expect(getByText(formatCurrency(900, 'PLN'))).toBeTruthy();
    expect(getByText(formatCurrency(600, 'PLN'))).toBeTruthy();
    expect(getByText(formatCurrency(1200, 'PLN'))).toBeTruthy();
    expect(getByText('projection_daily_pace')).toBeTruthy();
    expect(queryByTestId('projection-budget-marker')).toBeNull();
  });
  it.each([
    ['safe', 'projection_outcome_save_title', 1200],
    ['warn', 'projection_outcome_warn_title', 900],
    ['over', 'projection_outcome_over_title', 700],
    ['no_budget', 'projection_outcome_nobudget_title', 0],
  ] as const)('keeps %s forecasts distinct from actual spending', async (status, title, effectiveBudget) => {
    const { getByText, queryByText } = await render(
      <ProjectionCard {...base} timeframe="month" projectionInfo={{
        available: true, projected: 900, currentSpent: 600, dailyPace: 30,
        naiveDailyPace: 60, daysLeft: 10, effectiveBudget, status,
        deltaPct: null, hasOutlier: true, periodLabel: '23 Sep – 22 Oct', isCycle: true,
      }} />,
    );
    expect(getByText(title)).toBeTruthy();
    expect(getByText('projection_title_cycle')).toBeTruthy();
    expect(getByText('projection_outlier_note')).toBeTruthy();
    expect(getByText(formatCurrency(600, 'PLN'))).toBeTruthy();
    if (!effectiveBudget) expect(getByText('projection_no_budget')).toBeTruthy();
    expect(queryByText('projection_title')).toBeNull();
  });
});
