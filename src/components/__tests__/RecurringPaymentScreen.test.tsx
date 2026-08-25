import React from 'react';
import { act, render, waitFor } from '@testing-library/react-native';

import RecurringPaymentScreen from '../../../app/recurring-payment';
import { RecurringPaymentReminderDao } from '../../db/recurringPaymentReminderDao';
import { SubscriptionDao } from '../../db/subscriptionDao';

let mockParams: Record<string, string> = {};
const mockBack = jest.fn();
const mockRouter = { back: mockBack };
const mockTriggerRefresh = jest.fn();
const mockSyncNotifications = jest.fn(async () => undefined);
const mockT = (key: string) => key;
let mockFormProps: any = null;

jest.mock('expo-router', () => ({
  useLocalSearchParams: () => mockParams,
  useRouter: () => mockRouter,
}));
jest.mock('react-native-safe-area-context', () => {
  const React = require('react');
  const { View } = require('react-native');
  return { SafeAreaView: ({ children, ...props }: any) => React.createElement(View, props, children) };
});
jest.mock('../RecurringPaymentReminderSheet', () => {
  const React = require('react');
  const { View } = require('react-native');
  return (props: any) => {
    mockFormProps = props;
    return React.createElement(View, { testID: 'recurring-payment-form' });
  };
});
jest.mock('../../db/recurringPaymentReminderDao', () => ({
  RecurringPaymentReminderDao: { getById: jest.fn() },
}));
jest.mock('../../db/subscriptionDao', () => ({
  SubscriptionDao: { getAll: jest.fn() },
}));
jest.mock('../../context/CurrencyContext', () => ({ useCurrency: () => ({ currency: 'PLN' }) }));
jest.mock('../../context/RefreshContext', () => ({
  useRefreshActions: () => ({ triggerRefresh: mockTriggerRefresh }),
}));
jest.mock('../../context/NotificationsContext', () => ({
  useNotifications: () => ({ sync: mockSyncNotifications }),
}));
jest.mock('../../i18n/LanguageContext', () => ({
  useLanguage: () => ({ t: mockT }),
}));
jest.mock('../../theme/themeStore', () => ({ useAppTheme: () => 'light', useThemeRevision: () => 0 }));
jest.mock('../SparkToast', () => ({ SparkToast: { show: jest.fn() } }));

describe('RecurringPaymentScreen', () => {
  const getById = RecurringPaymentReminderDao.getById as jest.MockedFunction<
    typeof RecurringPaymentReminderDao.getById
  >;
  const getAll = SubscriptionDao.getAll as jest.MockedFunction<typeof SubscriptionDao.getAll>;

  beforeEach(() => {
    jest.clearAllMocks();
    mockParams = {};
    mockFormProps = null;
    getById.mockResolvedValue(null);
    getAll.mockResolvedValue([]);
  });

  it('manuel eklemeyi boş başlangıç değeriyle gerçek sayfada açar', async () => {
    const screen = await render(<RecurringPaymentScreen />);
    await waitFor(() => expect(screen.getByTestId('recurring-payment-form')).toBeTruthy());
    expect(screen.getByTestId('recurring-plan-header').parent)
      .not.toBe(screen.getByTestId('recurring-payment-form').parent);
    expect(screen.getByText('recurring_plan_add_title')).toBeTruthy();
    expect(mockFormProps.initialValue).toBeNull();
    expect(mockFormProps.defaultCurrency).toBe('PLN');

    await act(async () => { await mockFormProps.onSaved(); });
    expect(mockTriggerRefresh).toHaveBeenCalledTimes(1);
    expect(mockSyncNotifications).toHaveBeenCalledTimes(1);

    await act(async () => { mockFormProps.onClose(); });
    expect(mockBack).toHaveBeenCalledTimes(1);
  });

  it('kaydedilmiş planı native bildirim senkronu reddetse de başarısız göstermez', async () => {
    mockSyncNotifications.mockRejectedValueOnce(new Error('native inventory unavailable'));
    await render(<RecurringPaymentScreen />);
    await waitFor(() => expect(mockFormProps).not.toBeNull());

    await expect(act(async () => { await mockFormProps.onSaved(); })).resolves.toBeUndefined();
    expect(mockTriggerRefresh).toHaveBeenCalledTimes(1);
    expect(mockSyncNotifications).toHaveBeenCalledTimes(1);
  });

  it('düzenleme route kimliğiyle planı DAO üzerinden yükler', async () => {
    mockParams = { id: '41' };
    getById.mockResolvedValue({
      id: 41,
      uid: '7e59db87-966c-426d-aa4d-5bf9e4293840',
      title: 'Internet',
      vendor_id: null,
      expected_amount: 29.9,
      currency: 'PLN',
      anchor_date: '2026-09-15',
      next_due_date: '2026-09-15',
      recurrence_unit: 'month',
      recurrence_interval: 1,
      reminder_days_before: 3,
      reminder_time: '09:00',
      status: 'active',
      source: 'manual',
      note: null,
      created_at: '2026-08-21T10:00:00.000Z',
      updated_at: '2026-08-21T10:00:00.000Z',
    });

    await render(<RecurringPaymentScreen />);
    await waitFor(() => expect(mockFormProps?.initialValue?.id).toBe(41));
    expect(getById).toHaveBeenCalledWith(41);
    expect(mockFormProps.initialValue.title).toBe('Internet');
  });

  it('algılanan ödemeyi yalnız vendor kimliğinden güvenli form değerine dönüştürür', async () => {
    mockParams = { detectedVendorId: '8' };
    getAll.mockResolvedValue([{
      id: 3,
      vendor_id: 8,
      amount: 79.9,
      currency: 'PLN',
      period_days: 60,
      last_seen_date: '2026-08-15',
      next_expected_date: '2026-10-15',
      occurrences: 4,
      status: 'active',
      updated_at: '2026-08-21T10:00:00.000Z',
      vendor_name: 'Internet Provider',
      vendor_logo: null,
      category_id: null,
      category_name: null,
      category_icon: null,
      category_color: null,
    }]);

    await render(<RecurringPaymentScreen />);
    await waitFor(() => expect(mockFormProps?.initialValue?.vendorId).toBe(8));
    expect(mockFormProps.initialValue).toEqual(expect.objectContaining({
      title: 'Internet Provider',
      expectedAmount: 79.9,
      recurrenceUnit: 'month',
      recurrenceInterval: 2,
      source: 'detected',
    }));
  });
});
