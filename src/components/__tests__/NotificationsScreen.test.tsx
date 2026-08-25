import React from 'react';
import { fireEvent, render, waitFor } from '@testing-library/react-native';
import { Linking, Platform } from 'react-native';

import NotificationsScreen from '../../../app/notifications';
import type { InAppNotification } from '../../notifications/types';
import type {
  AndroidFutureScheduleSummary,
  AndroidNotificationSetupStatus,
} from '../../services/androidNotificationsSetup';

const mockMarkRead = jest.fn(async () => undefined);
const mockMarkAllRead = jest.fn(async () => undefined);
const dismissResult = (ids: readonly string[]) => ({
  removedIds: [...ids],
  removedCount: ids.length,
  feed: [],
  unreadCount: 0,
});
const mockDismiss = jest.fn(async (id: string) => dismissResult([id]));
const mockDismissMany = jest.fn(async (ids: readonly string[]) => dismissResult(ids));
const mockSetMute = jest.fn(async () => undefined);
const mockSync = jest.fn(async () => undefined);
const mockEnsureAndroidNotificationSetup: jest.Mock<
  Promise<AndroidNotificationSetupStatus>,
  []
> = jest.fn(async () => 'denied');
const mockGetAndroidFutureScheduleSummary: jest.Mock<
  Promise<AndroidFutureScheduleSummary>,
  []
> = jest.fn(async (): Promise<AndroidFutureScheduleSummary> => ({
  status: await mockEnsureAndroidNotificationSetup(),
  count: 0,
  nextTriggerAt: null,
  alertChannelStatus: 'unknown',
}));

const receiptNotification: InAppNotification = {
  id: 'receipt-visual-test',
  severity: 'info' as const,
  titleKey: 'notif_receipt_saved_t',
  bodyKey: 'notif_receipt_saved_b',
  params: { vendor: 'Örnek Market' },
  createdAt: new Date(2026, 6, 25, 17, 52).getTime(),
  read: false,
};

const budgetNotification: InAppNotification = {
  id: 'budget-visual-test',
  severity: 'warning' as const,
  titleKey: 'test_budget_title',
  bodyKey: 'test_budget_body',
  createdAt: new Date(2026, 6, 25, 14, 32).getTime(),
  read: true,
};

const debtNotification: InAppNotification = {
  id: 'debt-due-debt-1-2026-07-27-upcoming',
  severity: 'warning' as const,
  titleKey: 'test_debt_title',
  bodyKey: 'test_debt_body',
  createdAt: new Date(2026, 6, 25, 13, 30).getTime(),
  read: true,
};

const paymentPlanNotification: InAppNotification = {
  id: 'payplan-due-v1-plan-1-2026-07-27-upcoming',
  severity: 'info' as const,
  titleKey: 'test_payment_plan_title',
  bodyKey: 'test_payment_plan_body',
  createdAt: new Date(2026, 6, 25, 13, 20).getTime(),
  read: true,
};

const inferredSubscriptionNotification: InAppNotification = {
  id: 'sub-vendor-2-2026-07-28',
  severity: 'info' as const,
  titleKey: 'test_subscription_title',
  bodyKey: 'test_subscription_body',
  createdAt: new Date(2026, 6, 25, 13, 10).getTime(),
  read: true,
};

let mockNotifications = {
  feed: [receiptNotification, budgetNotification],
  unreadCount: 1,
  markRead: mockMarkRead,
  markAllRead: mockMarkAllRead,
  dismiss: mockDismiss,
  dismissMany: mockDismissMany,
  setMute: mockSetMute,
  mutes: {},
  sync: mockSync,
  syncing: false,
  nativeScheduleHealth: null as null | {
    status: 'ready' | 'error';
    desiredCount: number;
    verifiedCount: number;
    failedScheduleCount: number;
    failedCancelCount: number;
  },
};

jest.mock('expo-router', () => ({
  useRouter: () => ({ back: jest.fn() }),
  useFocusEffect: jest.fn(),
}));

jest.mock('react-native-safe-area-context', () => {
  const { View } = require('react-native');
  return {
    SafeAreaView: View,
    useSafeAreaInsets: () => ({ top: 0, right: 0, bottom: 0, left: 0 }),
  };
});

jest.mock('../../theme/themeStore', () => ({
  useAppTheme: () => 'light',
  useThemeRevision: () => 0,
}));

jest.mock('../../i18n/LanguageContext', () => ({
  useLanguage: () => ({
    t: (key: string, params?: Record<string, string | number>) => {
      const translations: Record<string, string> = {
        notif_center_title: 'Bildirimler',
        notif_mark_all: 'Tümünü okundu yap',
        notif_unread_label: 'Okunmamış',
        notif_selected: '{count} bildirim seçildi',
        notif_delete_selected_title: 'Bildirimleri sil',
        notif_delete_selected_confirm: '{count} bildirim silinsin mi?',
        notif_deleted_bulk: '{count} bildirim silindi',
        notif_select_hint: 'Çoklu seçim için basılı tutun',
        notif_filter_all: 'Tümü',
        notif_filter_budget: 'Bütçe',
        notif_filter_category: 'Kategori',
        notif_filter_goal: 'Hedef',
        notif_filter_receipt: 'Fiş',
        notif_filter_debt: 'Borç',
        notif_filter_payment_plan: 'Ödeme planı',
        notif_filter_subscription: 'Abonelik',
        notif_filter_backup: 'Yedek',
        notif_filter_system: 'Sistem',
        notif_mute_debt: 'Borç hatırlatmaları',
        notif_mute_payment_plan: 'Ödeme planı hatırlatmaları',
        notif_system_permission_ready: 'Telefon bildirimleri açık',
        notif_system_schedule_ready: '{count} tarihli uyarı Android’e planlandı',
        notif_system_schedule_next: 'Sıradaki uyarı: {date}, {time}',
        notif_system_schedule_error: 'Tarih planları Android’de doğrulanamadı. Planları yeniden onar.',
        notif_system_schedule_incomplete: '{count} uyarı doğrulanamadı',
        notif_system_schedule_repair: 'Planları onar',
        notif_system_alert_channel_blocked: 'Uyarılar kanalı sistemde kapalı',
        notif_system_alert_channel_unknown: 'Uyarı kanalının sistem durumu doğrulanamadı',
        notif_open_system_settings: 'Ayarları aç',
        notif_receipt_saved_t: '{vendor}',
        notif_receipt_saved_b: 'Fiş başarıyla işlendi ve işlem kaydedildi.',
        test_budget_title: 'Bütçe uyarısı',
        test_budget_body: 'Bütçene yaklaştın.',
        test_debt_title: 'Borç vadesi',
        test_debt_body: 'Borç vadesi yaklaşıyor.',
        test_payment_plan_title: 'Ödeme planı',
        test_payment_plan_body: 'Ödeme planı yaklaşıyor.',
        test_subscription_title: 'Tahmini abonelik',
        test_subscription_body: 'Tahmini abonelik ödemesi yaklaşıyor.',
      };
      let text = translations[key] ?? key;
      for (const [param, value] of Object.entries(params ?? {})) {
        text = text.replace(new RegExp(`{${param}}`, 'g'), String(value));
      }
      return text;
    },
  }),
}));

jest.mock('../../context/NotificationsContext', () => ({
  useNotifications: () => mockNotifications,
}));

jest.mock('../../services/androidNotificationsSetup', () => ({
  ensureAndroidNotificationSetup: () => mockEnsureAndroidNotificationSetup(),
  getAndroidFutureScheduleSummary: () => mockGetAndroidFutureScheduleSummary(),
}));

jest.mock('../BottomSheetModal', () => ({
  __esModule: true,
  default: ({ visible, children }: { visible: boolean; children: React.ReactNode }) =>
    visible ? <>{children}</> : null,
}));

jest.mock('../NotificationSwipeCard', () => {
  const React = require('react');
  const { Pressable, View } = require('react-native');
  return {
    __esModule: true,
    default: ({
      children,
      enabled,
      onDelete,
      testID,
    }: {
      children: React.ReactNode;
      enabled: boolean;
      onDelete: () => Promise<void>;
      testID: string;
    }) => (
      <View testID={testID} accessibilityState={{ disabled: !enabled }}>
        {children}
        <Pressable
          testID={`${testID}-delete-action`}
          onPress={() => void onDelete()}
        />
      </View>
    ),
  };
});

jest.mock('../GlassDeleteModal', () => {
  const React = require('react');
  const { Pressable, Text, View } = require('react-native');
  return {
    __esModule: true,
    default: ({
      visible,
      message,
      onDelete,
    }: {
      visible: boolean;
      message: string;
      onDelete: () => void;
    }) =>
      visible ? (
        <View testID="notifications-bulk-delete-modal">
          <Text>{message}</Text>
          <Pressable testID="notifications-bulk-delete-confirm" onPress={onDelete} />
        </View>
      ) : null,
  };
});

describe('NotificationsScreen', () => {
  beforeEach(() => {
    jest.clearAllMocks();
    mockEnsureAndroidNotificationSetup.mockResolvedValue('denied');
    mockGetAndroidFutureScheduleSummary.mockImplementation(async () => ({
      status: await mockEnsureAndroidNotificationSetup(),
      count: 0,
      nextTriggerAt: null,
      alertChannelStatus: 'unknown',
    }));
    mockNotifications = {
      ...mockNotifications,
      feed: [receiptNotification, budgetNotification],
      unreadCount: 1,
      nativeScheduleHealth: null,
    };
  });

  it('offers Android system settings when phone notifications are disabled', async () => {
    const originalOs = Object.getOwnPropertyDescriptor(Platform, 'OS');
    Object.defineProperty(Platform, 'OS', { configurable: true, value: 'android' });
    const openSettings = jest.spyOn(Linking, 'openSettings').mockResolvedValue(undefined);

    try {
      const screen = await render(<NotificationsScreen />);
      await fireEvent.press(screen.getByTestId('notifications-preferences'));

      await waitFor(() => {
        expect(mockEnsureAndroidNotificationSetup).toHaveBeenCalled();
        expect(screen.getByTestId('notifications-system-status')).toBeTruthy();
      });

      await fireEvent.press(screen.getByTestId('notifications-open-system-settings'));
      expect(openSettings).toHaveBeenCalledTimes(1);
    } finally {
      openSettings.mockRestore();
      if (originalOs) Object.defineProperty(Platform, 'OS', originalOs);
    }
  });

  it('shows channel health and a repair action when native coverage is incomplete', async () => {
    const originalOs = Object.getOwnPropertyDescriptor(Platform, 'OS');
    Object.defineProperty(Platform, 'OS', { configurable: true, value: 'android' });
    mockEnsureAndroidNotificationSetup.mockResolvedValue('ready');
    mockGetAndroidFutureScheduleSummary.mockResolvedValue({
      status: 'ready',
      count: 1,
      nextTriggerAt: new Date(2026, 7, 27, 9, 0).getTime(),
      alertChannelStatus: 'blocked',
    });
    mockNotifications = {
      ...mockNotifications,
      nativeScheduleHealth: {
        status: 'ready',
        desiredCount: 2,
        verifiedCount: 1,
        failedScheduleCount: 1,
        failedCancelCount: 0,
      },
    };

    try {
      const screen = await render(<NotificationsScreen />);
      await fireEvent.press(screen.getByTestId('notifications-preferences'));

      await waitFor(() => {
        expect(screen.getByText(/Uyarılar kanalı sistemde kapalı/)).toBeTruthy();
        expect(screen.getByTestId('notifications-open-system-settings')).toBeTruthy();
        expect(screen.getByTestId('notifications-repair-schedules')).toBeTruthy();
      });

      await fireEvent.press(screen.getByTestId('notifications-repair-schedules'));
      await waitFor(() => expect(mockSync).toHaveBeenCalledTimes(2));
    } finally {
      if (originalOs) Object.defineProperty(Platform, 'OS', originalOs);
    }
  });

  it('shows a scheduler reconciliation error instead of a healthy status', async () => {
    const originalOs = Object.getOwnPropertyDescriptor(Platform, 'OS');
    Object.defineProperty(Platform, 'OS', { configurable: true, value: 'android' });
    mockEnsureAndroidNotificationSetup.mockResolvedValue('ready');
    mockGetAndroidFutureScheduleSummary.mockResolvedValue({
      status: 'ready',
      count: 1,
      nextTriggerAt: new Date(2026, 7, 27, 9, 0).getTime(),
      alertChannelStatus: 'ready',
    });
    mockNotifications = {
      ...mockNotifications,
      nativeScheduleHealth: {
        status: 'error',
        desiredCount: 2,
        verifiedCount: 0,
        failedScheduleCount: 0,
        failedCancelCount: 0,
      },
    };

    try {
      const screen = await render(<NotificationsScreen />);
      await fireEvent.press(screen.getByTestId('notifications-preferences'));

      await waitFor(() => {
        expect(screen.getByText(
          /Tarih planları Android’de doğrulanamadı\. Planları yeniden onar\./,
        )).toBeTruthy();
        expect(screen.getByTestId('notifications-repair-schedules')).toBeTruthy();
      });
    } finally {
      if (originalOs) Object.defineProperty(Platform, 'OS', originalOs);
    }
  });

  it('offers retry and system settings when the native inventory summary fails', async () => {
    const originalOs = Object.getOwnPropertyDescriptor(Platform, 'OS');
    Object.defineProperty(Platform, 'OS', { configurable: true, value: 'android' });
    mockGetAndroidFutureScheduleSummary.mockResolvedValue({
      status: 'error',
      count: 0,
      nextTriggerAt: null,
      alertChannelStatus: 'unknown',
    });

    try {
      const screen = await render(<NotificationsScreen />);
      await fireEvent.press(screen.getByTestId('notifications-preferences'));

      await waitFor(() => {
        expect(screen.getByText(
          /Tarih planları Android’de doğrulanamadı\. Planları yeniden onar\./,
        )).toBeTruthy();
        expect(screen.getByTestId('notifications-open-system-settings')).toBeTruthy();
        expect(screen.getByTestId('notifications-repair-schedules')).toBeTruthy();
      });
    } finally {
      if (originalOs) Object.defineProperty(Platform, 'OS', originalOs);
    }
  });

  it('does not let a stale native status request overwrite a newer modal session', async () => {
    const originalOs = Object.getOwnPropertyDescriptor(Platform, 'OS');
    Object.defineProperty(Platform, 'OS', { configurable: true, value: 'android' });
    mockEnsureAndroidNotificationSetup.mockResolvedValue('ready');
    let resolveFirst!: (value: AndroidFutureScheduleSummary) => void;
    mockGetAndroidFutureScheduleSummary
      .mockImplementationOnce(() => new Promise((resolve) => {
        resolveFirst = resolve;
      }))
      .mockResolvedValueOnce({
        status: 'ready',
        count: 0,
        nextTriggerAt: null,
        alertChannelStatus: 'blocked',
      });

    try {
      const screen = await render(<NotificationsScreen />);
      await fireEvent.press(screen.getByTestId('notifications-preferences'));
      await waitFor(() => expect(mockGetAndroidFutureScheduleSummary).toHaveBeenCalledTimes(1));
      await fireEvent.press(screen.getByTestId('notifications-preferences-backdrop'));
      await fireEvent.press(screen.getByTestId('notifications-preferences'));

      await waitFor(() => {
        expect(mockGetAndroidFutureScheduleSummary).toHaveBeenCalledTimes(2);
        expect(screen.getByText(/Uyarılar kanalı sistemde kapalı/)).toBeTruthy();
      });

      resolveFirst({
        status: 'ready',
        count: 1,
        nextTriggerAt: Date.now() + 60_000,
        alertChannelStatus: 'ready',
      });
      await Promise.resolve();

      expect(screen.getByText(/Uyarılar kanalı sistemde kapalı/)).toBeTruthy();
    } finally {
      if (originalOs) Object.defineProperty(Platform, 'OS', originalOs);
    }
  });

  it('shows mark-all only while unread notifications exist', async () => {
    const view = await render(<NotificationsScreen />);
    expect(view.getByTestId('notifications-mark-all')).toBeTruthy();

    mockNotifications = { ...mockNotifications, unreadCount: 0 };
    await view.rerender(<NotificationsScreen />);

    expect(view.queryByTestId('notifications-mark-all')).toBeNull();
  });

  it('uses the canonical vendor as the receipt headline with a calm unread marker', async () => {
    const view = await render(<NotificationsScreen />);

    expect(view.getByText('Örnek Market')).toBeTruthy();
    expect(view.getByText('Fiş başarıyla işlendi ve işlem kaydedildi.')).toBeTruthy();
    expect(
      view.getByTestId(`notification-unread-indicator-${receiptNotification.id}`),
    ).toBeTruthy();
    expect(
      view.queryByTestId(`notification-unread-indicator-${budgetNotification.id}`),
    ).toBeNull();
    expect(
      view.getByTestId(`notification-card-${receiptNotification.id}`).props.accessibilityLabel,
    ).toContain('Okunmamış');

    mockNotifications = {
      ...mockNotifications,
      feed: [{ ...receiptNotification, read: true }, budgetNotification],
      unreadCount: 0,
    };
    await view.rerender(<NotificationsScreen />);

    expect(
      view.queryByTestId(`notification-unread-indicator-${receiptNotification.id}`),
    ).toBeNull();
    expect(
      view.getByTestId(`notification-card-${receiptNotification.id}`).props.accessibilityLabel,
    ).not.toContain('Okunmamış');
  });

  it('keeps the detail and swipe-delete actions separate', async () => {
    const view = await render(<NotificationsScreen />);

    await fireEvent.press(
      view.getByTestId(`notification-swipe-${receiptNotification.id}-delete-action`),
    );
    expect(mockDismiss).toHaveBeenCalledWith(receiptNotification.id);
    expect(mockMarkRead).not.toHaveBeenCalled();

    await fireEvent.press(view.getByTestId(`notification-card-${receiptNotification.id}`));
    expect(mockMarkRead).toHaveBeenCalledWith(receiptNotification.id);
  });

  it('keeps an open detail sheet bound to the current feed item', async () => {
    const view = await render(<NotificationsScreen />);
    await fireEvent.press(view.getByTestId(`notification-card-${receiptNotification.id}`));

    expect(view.getAllByText('Örnek Market')).toHaveLength(2);

    mockNotifications = {
      ...mockNotifications,
      feed: [
        {
          ...receiptNotification,
          params: { vendor: 'Güncel Market' },
        },
        budgetNotification,
      ],
    };
    await view.rerender(<NotificationsScreen />);

    expect(view.queryByText('Örnek Market')).toBeNull();
    expect(view.getAllByText('Güncel Market')).toHaveLength(2);
  });

  it('filters notification channels and exposes the selected tab state', async () => {
    const view = await render(<NotificationsScreen />);
    const allFilter = view.getByTestId('notifications-filter-all');
    const budgetFilter = view.getByTestId('notifications-filter-budget');

    expect(allFilter.props.accessibilityState).toMatchObject({ selected: true });
    expect(view.getByTestId(`notification-card-${receiptNotification.id}`)).toBeTruthy();

    await fireEvent.press(budgetFilter);

    expect(
      view.getByTestId('notifications-filter-budget').props.accessibilityState,
    ).toMatchObject({ selected: true });
    expect(view.queryByTestId(`notification-card-${receiptNotification.id}`)).toBeNull();
    expect(view.getByTestId(`notification-card-${budgetNotification.id}`)).toBeTruthy();
  });

  it('keeps debt, confirmed plans, and inferred subscriptions in separate channels', async () => {
    mockNotifications = {
      ...mockNotifications,
      feed: [debtNotification, paymentPlanNotification, inferredSubscriptionNotification],
      unreadCount: 0,
    };
    const view = await render(<NotificationsScreen />);

    await fireEvent.press(view.getByTestId('notifications-filter-debt'));
    expect(view.getByTestId(`notification-card-${debtNotification.id}`)).toBeTruthy();
    expect(
      view.queryByTestId(`notification-card-${paymentPlanNotification.id}`),
    ).toBeNull();
    expect(
      view.queryByTestId(`notification-card-${inferredSubscriptionNotification.id}`),
    ).toBeNull();

    await fireEvent.press(view.getByTestId('notifications-filter-payment_plan'));
    expect(view.queryByTestId(`notification-card-${debtNotification.id}`)).toBeNull();
    expect(
      view.getByTestId(`notification-card-${paymentPlanNotification.id}`),
    ).toBeTruthy();
    expect(
      view.queryByTestId(`notification-card-${inferredSubscriptionNotification.id}`),
    ).toBeNull();

    await fireEvent.press(view.getByTestId('notifications-filter-subscription'));
    expect(view.queryByTestId(`notification-card-${debtNotification.id}`)).toBeNull();
    expect(
      view.queryByTestId(`notification-card-${paymentPlanNotification.id}`),
    ).toBeNull();
    expect(
      view.getByTestId(`notification-card-${inferredSubscriptionNotification.id}`),
    ).toBeTruthy();

    await fireEvent.press(view.getByTestId('notifications-filter-system'));
    expect(view.queryByTestId(`notification-card-${debtNotification.id}`)).toBeNull();
    expect(
      view.queryByTestId(`notification-card-${paymentPlanNotification.id}`),
    ).toBeNull();
    expect(
      view.queryByTestId(`notification-card-${inferredSubscriptionNotification.id}`),
    ).toBeNull();
  });

  it('exposes debt reminder muting in notification preferences', async () => {
    const view = await render(<NotificationsScreen />);

    await fireEvent.press(view.getByTestId('notifications-preferences'));

    expect(view.getByText('Borç hatırlatmaları')).toBeTruthy();
    expect(view.getByText('Ödeme planı hatırlatmaları')).toBeTruthy();
  });

  it('disables swipe while selecting and deletes all selected IDs in one call', async () => {
    const view = await render(<NotificationsScreen />);
    const receiptCard = view.getByTestId(`notification-card-${receiptNotification.id}`);

    await fireEvent(receiptCard, 'longPress');

    expect(mockMarkRead).not.toHaveBeenCalled();
    expect(
      view.queryByTestId(`notification-unread-indicator-${receiptNotification.id}`),
    ).toBeNull();
    expect(view.getByTestId('notifications-selection-delete')).toBeTruthy();
    expect(
      view.getByTestId(`notification-card-${receiptNotification.id}`).props.accessibilityState,
    ).toMatchObject({ checked: true });
    expect(
      view.getByTestId(`notification-swipe-${receiptNotification.id}`).props.accessibilityState,
    ).toMatchObject({ disabled: true });

    await fireEvent.press(view.getByTestId(`notification-card-${budgetNotification.id}`));
    expect(
      view.getByTestId(`notification-card-${budgetNotification.id}`).props.accessibilityState,
    ).toMatchObject({ checked: true });

    await fireEvent.press(view.getByTestId('notifications-selection-delete'));
    expect(view.getByTestId('notifications-bulk-delete-modal')).toBeTruthy();
    await fireEvent.press(view.getByTestId('notifications-bulk-delete-confirm'));

    await waitFor(() => {
      expect(mockDismissMany).toHaveBeenCalledTimes(1);
    });
    expect(new Set(mockDismissMany.mock.calls[0][0])).toEqual(
      new Set([receiptNotification.id, budgetNotification.id]),
    );
  });
});
