// react-native-reanimated → __mocks__/react-native-reanimated.js (otomatik)
import React from 'react';
import { fireEvent, render } from '@testing-library/react-native';
import LimitsHealthCard from '../LimitsHealthCard';
import { getAnalyticsStyles } from '../analyticsStyles';
import type { LimitsHealthInfo } from '../shared';

const base = { styles: getAnalyticsStyles(), t: (k: string) => k, tc: (k: string) => k, currency: 'PLN' as const };

describe('LimitsHealthCard', () => {
  it('limit yoksa boş durumu gösterir', async () => {
    const onManageLimits = jest.fn();
    const info: LimitsHealthInfo = { count: 0, overCount: 0, warnCount: 0, safeCount: 0, items: [] };
    const { getByText } = await render(
      <LimitsHealthCard {...base} limitsHealthInfo={info} onManageLimits={onManageLimits} />,
    );
    expect(getByText('limits_health_empty_title')).toBeTruthy();
    fireEvent.press(getByText('goal_settings_add_limit'));
    expect(onManageLimits).toHaveBeenCalledTimes(1);
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
