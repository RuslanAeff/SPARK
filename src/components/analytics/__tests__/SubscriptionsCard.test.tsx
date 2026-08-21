// react-native-reanimated otomatik olarak __mocks__/react-native-reanimated.js ile
// değiştirilir (jest, node_modules komşusu __mocks__'u otomatik kullanır).
import React from 'react';
import { render } from '@testing-library/react-native';
import SubscriptionsCard from '../SubscriptionsCard';
import { getAnalyticsStyles } from '../analyticsStyles';
import type { SubscriptionInfo } from '../shared';

const styles = getAnalyticsStyles();
const t = (k: string) => k;
const tc = (k: string) => k;

const base = { styles, t, tc, currency: 'PLN' as const };

describe('SubscriptionsCard', () => {
  it('abonelik yoksa boş durumu gösterir', async () => {
    const info: SubscriptionInfo = { count: 0, monthlyTotal: 0, upcoming: [] };
    const { getByText } = await render(<SubscriptionsCard {...base} subscriptionInfo={info} />);
    expect(getByText('subs_card_empty_title')).toBeTruthy();
    expect(getByText('subs_card_empty_hint')).toBeTruthy();
  });

  it('abonelik varsa sayıyı, başlığı ve yaklaşan satıcıyı gösterir', async () => {
    const info: SubscriptionInfo = {
      count: 2,
      monthlyTotal: 50,
      upcoming: [{ id: 1, vendor_name: 'Netflix', amount: 39.99, daysUntil: 3 } as any],
    };
    const { getByText } = await render(<SubscriptionsCard {...base} subscriptionInfo={info} />);
    expect(getByText('subs_card_title')).toBeTruthy();
    expect(getByText('2')).toBeTruthy();        // sayı rozeti
    expect(getByText('Netflix')).toBeTruthy();  // yaklaşan abonelik
  });

  it('tutarı girilmemiş onaylı planı sıfır gibi göstermeden listeler', async () => {
    const info: SubscriptionInfo = {
      count: 1,
      monthlyTotal: 0,
      upcoming: [{ id: 'confirmed:4', vendor_name: 'İnternet', amount: null, daysUntil: 2 } as any],
    };
    const { getByText } = await render(<SubscriptionsCard {...base} subscriptionInfo={info} />);
    expect(getByText('İnternet')).toBeTruthy();
    expect(getByText('—')).toBeTruthy();
  });
});
