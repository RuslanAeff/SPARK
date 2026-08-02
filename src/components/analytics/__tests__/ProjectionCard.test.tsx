// react-native-reanimated → __mocks__/react-native-reanimated.js (otomatik)
import React from 'react';
import { render } from '@testing-library/react-native';
import ProjectionCard from '../ProjectionCard';
import { getAnalyticsStyles } from '../analyticsStyles';
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

    const { getByText, getAllByText } = await render(
      <ProjectionCard {...base} timeframe="month" projectionInfo={projectionInfo} />,
    );

    expect(getByText('projection_title')).toBeTruthy();
    expect(getAllByText('projection_estimated')).toHaveLength(2);
    expect(getByText('projection_daily_pace')).toBeTruthy();
  });
});
