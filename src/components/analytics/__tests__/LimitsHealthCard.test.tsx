// react-native-reanimated → __mocks__/react-native-reanimated.js (otomatik)
import React from 'react';
import { render } from '@testing-library/react-native';
import LimitsHealthCard from '../LimitsHealthCard';
import { getAnalyticsStyles } from '../analyticsStyles';
import type { LimitsHealthInfo } from '../shared';

const base = { styles: getAnalyticsStyles(), t: (k: string) => k, tc: (k: string) => k, currency: 'PLN' as const };

describe('LimitsHealthCard', () => {
  it('limit yoksa kartı göstermez', async () => {
    const info: LimitsHealthInfo = { count: 0, overCount: 0, warnCount: 0, safeCount: 0, items: [] };
    const { toJSON } = await render(<LimitsHealthCard {...base} limitsHealthInfo={info} />);
    expect(toJSON()).toBeNull();
  });

  it('limiti aşan kategoriyi adı ve yüzdesiyle gösterir', async () => {
    const info: LimitsHealthInfo = {
      count: 1, overCount: 1, warnCount: 0, safeCount: 0,
      items: [{ category_id: 1, category_name: 'Market', category_icon: null as any, category_color: '#888', limit: 100, spent: 120 }],
    };
    const { getByText } = await render(<LimitsHealthCard {...base} limitsHealthInfo={info} />);
    expect(getByText('Market')).toBeTruthy();   // tc(category_name)
    expect(getByText('120%')).toBeTruthy();      // spent/limit oranı
  });
});
