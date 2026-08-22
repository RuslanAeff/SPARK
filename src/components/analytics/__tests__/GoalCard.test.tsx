import React from 'react';
import { render } from '@testing-library/react-native';
import GoalCard from '../GoalCard';
import { getAnalyticsStyles } from '../analyticsStyles';

const base = {
  styles: getAnalyticsStyles(),
  t: (key: string) => key,
  tc: (key: string) => key,
  currency: 'PLN' as const,
};

describe('GoalCard', () => {
  it('birikim hedefi yoksa kartı göstermez', async () => {
    const { toJSON } = await render(
      <GoalCard {...base} goalInfo={{ available: false }} />,
    );

    expect(toJSON()).toBeNull();
  });
});
