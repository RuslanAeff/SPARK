import React from 'react';
import { render } from '@testing-library/react-native';

jest.mock('../shared', () => {
  const ReactRuntime = require('react');
  const { Text: NativeText } = require('react-native');
  const actual = jest.requireActual('../shared');
  return {
    ...actual,
    CountUpText: ({ value, style }: { value: number; style?: unknown }) =>
      ReactRuntime.createElement(NativeText, { style }, String(value)),
  };
});

import StreakCard from '../StreakCard';
import { getAnalyticsStyles } from '../analyticsStyles';
import type { StreakData } from '../shared';

const base = {
  styles: getAnalyticsStyles(),
  t: (key: string) => key,
  tc: (key: string) => key,
  currency: 'PLN' as const,
  setStreakDetailVariant: jest.fn(),
};

function result(overrides: Partial<StreakData> = {}): StreakData {
  return {
    status: 'ready',
    streakMode: 'current',
    scopeStart: '2026-08-01',
    scopeEnd: '2026-08-01',
    dailyTarget: null,
    zeroSpendDays: 1,
    currentStreak: 1,
    underBudgetDays: 0,
    totalDays: 1,
    recordedDays: 0,
    coveragePct: 0,
    zeroSpendDates: ['2026-08-01'],
    currentStreakDates: ['2026-08-01'],
    underBudgetEntries: [],
    ...overrides,
  };
}

describe('StreakCard', () => {
  beforeEach(() => jest.clearAllMocks());

  it('uses an honest period-end label for historical selections', async () => {
    const screen = await render(
      <StreakCard {...base} streakData={result({ streakMode: 'period_end' })} />,
    );

    expect(screen.getByText('period_end_streak')).toBeTruthy();
    expect(screen.queryByText('current_streak')).toBeNull();
  });

  it('shows the plan metric only when a stable daily target is available', async () => {
    const unavailable = await render(
      <StreakCard {...base} streakData={result({ dailyTarget: null })} />,
    );
    expect(unavailable.queryByText('under_budget_days')).toBeNull();
    await unavailable.unmount();

    const available = await render(
      <StreakCard
        {...base}
        streakData={result({ dailyTarget: 100, underBudgetDays: 1 })}
      />,
    );
    expect(available.getByText('under_budget_days')).toBeTruthy();
  });

  it('does not present missing all-time history as a saving achievement', async () => {
    const screen = await render(
      <StreakCard
        {...base}
        streakData={result({
          status: 'no_data',
          scopeStart: null,
          scopeEnd: null,
          zeroSpendDays: 0,
          currentStreak: 0,
          totalDays: 0,
          zeroSpendDates: [],
          currentStreakDates: [],
        })}
      />,
    );

    expect(screen.getByText('streak_no_data')).toBeTruthy();
    expect(screen.queryByText('streak_coverage_summary')).toBeNull();
  });

  it('bases its encouragement on the whole period and shows tracking coverage', async () => {
    const screen = await render(
      <StreakCard
        {...base}
        streakData={result({
          zeroSpendDays: 4,
          currentStreak: 0,
          totalDays: 10,
          recordedDays: 6,
          coveragePct: 60,
        })}
      />,
    );

    expect(screen.getByText('streak_tracking_great')).toBeTruthy();
    expect(screen.getByText('streak_coverage_summary')).toBeTruthy();
  });

  it('does not treat a period with no spending records as a saving success', async () => {
    const screen = await render(
      <StreakCard
        {...base}
        streakData={result({
          zeroSpendDays: 10,
          currentStreak: 10,
          totalDays: 10,
          recordedDays: 0,
          coveragePct: 0,
        })}
      />,
    );

    expect(screen.getByText('streak_no_recorded_days')).toBeTruthy();
    expect(screen.queryByText('streak_great')).toBeNull();
  });

  it('uses the whole period’s within-plan ratio when a daily plan exists', async () => {
    const screen = await render(
      <StreakCard
        {...base}
        streakData={result({
          dailyTarget: 100,
          zeroSpendDays: 2,
          underBudgetDays: 4,
          totalDays: 10,
          recordedDays: 8,
          coveragePct: 80,
        })}
      />,
    );

    expect(screen.getByText('streak_great')).toBeTruthy();
  });

  it('does not render short history as zero-valued achievements', async () => {
    const screen = await render(
      <StreakCard
        {...base}
        streakData={result({
          status: 'insufficient_history',
          zeroSpendDays: 0,
          currentStreak: 0,
          totalDays: 2,
          recordedDays: 1,
          coveragePct: 50,
          zeroSpendDates: [],
          currentStreakDates: [],
        })}
      />,
    );

    expect(screen.getByText('streak_insufficient_history')).toBeTruthy();
    expect(screen.getAllByText('—')).toHaveLength(2);
  });
});
