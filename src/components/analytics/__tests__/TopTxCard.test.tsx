// react-native-reanimated → __mocks__/react-native-reanimated.js (otomatik)
import React from 'react';
import { render } from '@testing-library/react-native';
import TopTxCard from '../TopTxCard';
import { getAnalyticsStyles } from '../analyticsStyles';

const base = { styles: getAnalyticsStyles(), t: (k: string) => k, tc: (k: string) => k, currency: 'PLN' as const };

describe('TopTxCard', () => {
  it('işlem yoksa hiçbir şey render etmez (null)', async () => {
    const { toJSON } = await render(<TopTxCard {...base} topTx={[]} />);
    expect(toJSON()).toBeNull();
  });

  it('işlemleri satıcı adlarıyla listeler', async () => {
    const topTx = [
      { id: 1, vendor_name: 'Migros', date: '2026-06-21', category_name: 'Market', total_amount: 120 } as any,
      { id: 2, vendor_name: 'Shell', date: '2026-06-20', category_name: 'Yakıt', total_amount: 200 } as any,
    ];
    const { getByText } = await render(<TopTxCard {...base} topTx={topTx} />);
    expect(getByText('top_transactions')).toBeTruthy();
    expect(getByText('Migros')).toBeTruthy();
    expect(getByText('Shell')).toBeTruthy();
  });
});
