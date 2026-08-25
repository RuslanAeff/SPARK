import React, { useEffect, useMemo, useState } from 'react';
import { ActivityIndicator, Pressable, StyleSheet, Text, View } from 'react-native';
import { useLocalSearchParams, useRouter } from 'expo-router';
import { SafeAreaView } from 'react-native-safe-area-context';
import { MaterialCommunityIcons } from '@expo/vector-icons';

import RecurringPaymentReminderForm, {
  type RecurringPaymentReminderFormValue,
} from '../src/components/RecurringPaymentReminderSheet';
import { SparkToast } from '../src/components/SparkToast';
import { useCurrency } from '../src/context/CurrencyContext';
import { useNotifications } from '../src/context/NotificationsContext';
import { useRefreshActions } from '../src/context/RefreshContext';
import { syncNotificationsBestEffort } from '../src/notifications/syncNotificationsBestEffort';
import { RecurringPaymentReminderDao } from '../src/db/recurringPaymentReminderDao';
import { SubscriptionDao } from '../src/db/subscriptionDao';
import type { RecurringPaymentReminder } from '../src/db/schema';
import { useLanguage } from '../src/i18n/LanguageContext';
import { Colors } from '../src/theme/colors';
import { ScreenPadding, Spacing } from '../src/theme/spacing';
import { useAppTheme, useThemeRevision } from '../src/theme/themeStore';
import { FontFamily, Typography } from '../src/theme/typography';
import { scheduleFromDetectedPeriod } from '../src/utils/recurringPaymentPlan';

type RouteParam = string | string[] | undefined;

function firstParam(value: RouteParam): string | undefined {
  return Array.isArray(value) ? value[0] : value;
}

function positiveInteger(value: RouteParam): number | null {
  const text = firstParam(value);
  if (!text || !/^[1-9]\d*$/.test(text)) return null;
  const parsed = Number(text);
  return Number.isSafeInteger(parsed) ? parsed : null;
}

function fromReminder(plan: RecurringPaymentReminder): RecurringPaymentReminderFormValue {
  return {
    id: plan.id,
    title: plan.title,
    vendorId: plan.vendor_id,
    expectedAmount: plan.expected_amount,
    currency: plan.currency,
    anchorDate: plan.anchor_date,
    nextDueDate: plan.next_due_date,
    recurrenceUnit: plan.recurrence_unit,
    recurrenceInterval: plan.recurrence_interval,
    reminderDaysBefore: plan.reminder_days_before,
    reminderTime: plan.reminder_time,
    status: plan.status,
    source: plan.source,
    note: plan.note,
  };
}

export default function RecurringPaymentScreen() {
  const scheme = useAppTheme();
  const themeRevision = useThemeRevision();
  const styles = useMemo(() => getStyles(), [scheme, themeRevision]);
  const router = useRouter();
  const params = useLocalSearchParams<{ id?: string; detectedVendorId?: string }>();
  const { currency } = useCurrency();
  const { triggerRefresh } = useRefreshActions();
  const { sync: syncNotifications } = useNotifications();
  const { t } = useLanguage();
  const isEditing = firstParam(params.id) != null;
  const [initialValue, setInitialValue] = useState<
    RecurringPaymentReminderFormValue | null | undefined
  >(undefined);

  useEffect(() => {
    let active = true;

    const load = async () => {
      const rawId = firstParam(params.id);
      const rawVendorId = firstParam(params.detectedVendorId);
      try {
        if (rawId) {
          const id = positiveInteger(rawId);
          if (id == null) throw new Error('Invalid reminder id');
          const plan = await RecurringPaymentReminderDao.getById(id);
          if (!plan) throw new Error('Reminder not found');
          if (active) setInitialValue(fromReminder(plan));
          return;
        }

        if (rawVendorId) {
          const vendorId = positiveInteger(rawVendorId);
          if (vendorId == null) throw new Error('Invalid vendor id');
          const detected = (await SubscriptionDao.getAll())
            .find((item) => item.vendor_id === vendorId);
          if (!detected) throw new Error('Detected payment not found');
          const cadence = scheduleFromDetectedPeriod(detected.period_days);
          if (active) {
            setInitialValue({
              title: detected.vendor_name,
              vendorId: detected.vendor_id,
              expectedAmount: detected.amount,
              currency: detected.currency,
              anchorDate: detected.next_expected_date,
              nextDueDate: detected.next_expected_date,
              recurrenceUnit: cadence.unit,
              recurrenceInterval: cadence.interval,
              reminderDaysBefore: 3,
              reminderTime: '09:00',
              status: 'active',
              source: 'detected',
              note: null,
            });
          }
          return;
        }

        if (active) setInitialValue(null);
      } catch (error) {
        if (__DEV__) console.warn('[recurring-plan] route load', error);
        if (!active) return;
        SparkToast.show(t('recurring_plan_save_error'), 'error');
        router.back();
      }
    };

    setInitialValue(undefined);
    void load();
    return () => { active = false; };
  }, [params.detectedVendorId, params.id, router, t]);

  return (
    <SafeAreaView style={styles.container} edges={['top', 'right', 'bottom', 'left']}>
      <View testID="recurring-plan-header" style={styles.header}>
        <Pressable
          testID="recurring-plan-back"
          accessibilityRole="button"
          accessibilityLabel={t('back')}
          onPress={() => router.back()}
          style={({ pressed }) => [styles.backButton, pressed && styles.pressed]}
        >
          <MaterialCommunityIcons name="chevron-left" size={28} color={Colors.textPrimary} />
        </Pressable>
        <View style={styles.headerCopy}>
          <Text style={styles.title}>
            {t(isEditing ? 'recurring_plan_edit_title' : 'recurring_plan_add_title')}
          </Text>
          <Text style={styles.subtitle}>{t('recurring_plan_form_hint')}</Text>
        </View>
        <View style={styles.headerBalance} />
      </View>

      <View style={styles.body}>
        {initialValue === undefined ? (
          <View style={styles.loading}>
            <ActivityIndicator color={Colors.primary} />
          </View>
        ) : (
          <RecurringPaymentReminderForm
            initialValue={initialValue}
            defaultCurrency={currency}
            onClose={() => router.back()}
            onSaved={async () => {
              triggerRefresh();
              // Kullanıcı ekranı kapatmadan önce yeni/değişmiş tarihli alarmı
              // doğrudan Android'e kur ve gerçek envanterden doğrula. Kök 300 ms
              // debounce'u yalnız genel UI yenilemesi için kalır.
              await syncNotificationsBestEffort(syncNotifications, 'recurring-plan-save');
            }}
          />
        )}
      </View>
    </SafeAreaView>
  );
}

const getStyles = () => StyleSheet.create({
  container: { flex: 1, backgroundColor: Colors.background },
  header: {
    flexDirection: 'row', alignItems: 'center', gap: Spacing.sm,
    paddingHorizontal: ScreenPadding.horizontal, paddingVertical: Spacing.md,
    borderBottomWidth: StyleSheet.hairlineWidth, borderBottomColor: Colors.border,
    backgroundColor: Colors.background,
  },
  backButton: {
    width: 44, height: 44, borderRadius: 22, alignItems: 'center', justifyContent: 'center',
    backgroundColor: Colors.surface,
  },
  headerCopy: { flex: 1, minWidth: 0 },
  headerBalance: { width: 44, height: 44 },
  title: { ...Typography.headlineSmall, color: Colors.textPrimary, fontFamily: FontFamily.bold },
  subtitle: { ...Typography.bodySmall, color: Colors.textSecondary, marginTop: 2 },
  body: { flex: 1, minHeight: 0 },
  loading: { flex: 1, alignItems: 'center', justifyContent: 'center' },
  pressed: { opacity: 0.72 },
});
