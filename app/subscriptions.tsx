// S.P.A.R.K. — Abonelikler / Tekrar Eden Ödemeler
// Yerel veriden tespit edilen düzenli ödemeleri listeler. Kullanıcı "abonelik
// değil" diyerek bir kalemi gizleyebilir veya gizlediği bir kalemi geri
// alabilir.
import React, { useCallback, useEffect, useMemo, useState } from 'react';
import {
  View,
  Text,
  StyleSheet,
  Pressable,
  ScrollView,
  RefreshControl,
  ActivityIndicator,
} from 'react-native';
import { useFocusEffect, useRouter } from 'expo-router';
import { MaterialCommunityIcons } from '@expo/vector-icons';
import { SafeAreaView } from 'react-native-safe-area-context';
import Animated, { FadeInDown } from 'react-native-reanimated';
import * as Haptics from 'expo-haptics';

import { Colors } from '../src/theme/colors';
import { useAppTheme, useThemeRevision } from '../src/theme/themeStore';
import { Typography, FontFamily } from '../src/theme/typography';
import { Spacing, ScreenPadding, BorderRadius } from '../src/theme/spacing';
import { useLanguage } from '../src/i18n/LanguageContext';
import { useCurrency } from '../src/context/CurrencyContext';
import { formatCurrency } from '../src/utils/formatCurrency';
import { intlLocaleForLanguage } from '../src/i18n/languageOptions';
import { SubscriptionDao } from '../src/db/subscriptionDao';
import {
  monthlyEquivalent,
  periodLabelKey,
  syncSubscriptions,
} from '../src/services/subscriptionDetector';
import type { SubscriptionWithDetails } from '../src/db/schema';
import { SparkToast } from '../src/components/SparkToast';
import GlassDeleteModal from '../src/components/GlassDeleteModal';
import { RecurringPaymentReminderDao } from '../src/db/recurringPaymentReminderDao';
import type { RecurringPaymentReminder } from '../src/db/schema';
import { formatDateFull } from '../src/utils/dateUtils';
import { useRefreshActions } from '../src/context/RefreshContext';

function daysUntil(dateIso: string): number {
  const target = new Date(dateIso + 'T12:00:00').getTime();
  const today = new Date();
  today.setHours(0, 0, 0, 0);
  return Math.ceil((target - today.getTime()) / (86400 * 1000));
}

export default function SubscriptionsScreen() {
  const scheme = useAppTheme();
  const themeRevision = useThemeRevision();
  const styles = useMemo(() => getStyles(), [scheme, themeRevision]);
  const router = useRouter();
  const { t, language } = useLanguage();
  const { currency } = useCurrency();
  const { triggerRefresh } = useRefreshActions();
  const [items, setItems] = useState<SubscriptionWithDetails[]>([]);
  const [plans, setPlans] = useState<RecurringPaymentReminder[]>([]);
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [showDismissed, setShowDismissed] = useState(false);
  const [deletePlan, setDeletePlan] = useState<RecurringPaymentReminder | null>(null);
  const planActionRef = React.useRef(false);

  const refresh = useCallback(async () => {
    try {
      await syncSubscriptions();
      const list = await SubscriptionDao.getAll();
      setItems(list);
      const reminderRows = await RecurringPaymentReminderDao.listAll();
      setPlans(reminderRows);
    } catch (e) {
      if (__DEV__) console.warn('[subs] refresh', e);
    }
  }, []);

  useEffect(() => {
    (async () => {
      setLoading(true);
      await refresh();
      setLoading(false);
    })();
  }, [refresh]);

  useFocusEffect(
    useCallback(() => {
      void refresh();
    }, [refresh])
  );

  const onPullRefresh = useCallback(async () => {
    setRefreshing(true);
    await refresh();
    setRefreshing(false);
  }, [refresh]);

  const confirmedVendorIds = new Set(
    plans.filter((plan) => plan.source === 'detected' && plan.vendor_id != null)
      .map((plan) => plan.vendor_id as number),
  );
  const active = items.filter(
    (s) => s.status === 'active' && !confirmedVendorIds.has(s.vendor_id),
  );
  const dismissed = items.filter((s) => s.status === 'dismissed');
  const monthlyTotal = active.reduce(
    (sum, s) => sum + monthlyEquivalent(s.amount, s.period_days),
    0
  );

  async function handleDismiss(s: SubscriptionWithDetails) {
    Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);
    await SubscriptionDao.setStatus(s.vendor_id, 'dismissed');
    SparkToast.show(t('subscription_dismissed'), 'info', s.vendor_name);
    await refresh();
    triggerRefresh();
  }
  async function handleRestore(s: SubscriptionWithDetails) {
    Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);
    await SubscriptionDao.setStatus(s.vendor_id, 'active');
    SparkToast.show(t('subscription_restored'), 'success', s.vendor_name);
    await refresh();
    triggerRefresh();
  }

  const openManualPlan = () => {
    router.push('/recurring-payment');
  };

  const openDetectedPlan = (subscription: SubscriptionWithDetails) => {
    router.push({
      pathname: '/recurring-payment',
      params: { detectedVendorId: String(subscription.vendor_id) },
    });
  };

  const openEditPlan = (plan: RecurringPaymentReminder) => {
    router.push({
      pathname: '/recurring-payment',
      params: { id: String(plan.id) },
    });
  };

  const togglePlan = async (plan: RecurringPaymentReminder) => {
    if (planActionRef.current) return;
    planActionRef.current = true;
    try {
      const changed = plan.status === 'active'
        ? await RecurringPaymentReminderDao.pause(plan.id)
        : await RecurringPaymentReminderDao.resume(plan.id);
      if (!changed) throw new Error('Plan was not updated');
      SparkToast.show(
        t(plan.status === 'active' ? 'recurring_plan_paused' : 'recurring_plan_resumed'),
        'success',
      );
      await refresh();
      triggerRefresh();
    } catch (error) {
      if (__DEV__) console.warn('[recurring-plan] toggle', error);
      SparkToast.show(t('recurring_plan_save_error'), 'error');
    } finally {
      planActionRef.current = false;
    }
  };

  const removePlan = async () => {
    if (!deletePlan || planActionRef.current) return;
    planActionRef.current = true;
    try {
      const removed = await RecurringPaymentReminderDao.remove(deletePlan.id);
      if (!removed) throw new Error('Plan was not removed');
      setDeletePlan(null);
      SparkToast.show(t('recurring_plan_deleted'), 'success');
      await refresh();
      triggerRefresh();
    } catch (error) {
      if (__DEV__) console.warn('[recurring-plan] remove', error);
      SparkToast.show(t('recurring_plan_save_error'), 'error');
    } finally {
      planActionRef.current = false;
    }
  };

  const recurrenceLabel = (plan: RecurringPaymentReminder) => {
    const unitLabel = t(`recurring_plan_unit_${plan.recurrence_unit}`);
    return plan.recurrence_interval === 1
      ? unitLabel
      : t('recurring_plan_every_interval', {
          interval: plan.recurrence_interval,
          unit: unitLabel.toLocaleLowerCase(),
        });
  };

  const renderPlan = (plan: RecurringPaymentReminder) => (
    <View key={plan.id} style={[styles.planCard, plan.status === 'paused' && styles.cardMuted]}>
      <View style={styles.planTopRow}>
        <View style={styles.planIcon}>
          <MaterialCommunityIcons name="calendar-sync-outline" size={21} color={Colors.primary} />
        </View>
        <View style={styles.planMain}>
          <View style={styles.planTitleRow}>
            <Text style={styles.planTitle} numberOfLines={2}>{plan.title}</Text>
            <View style={[styles.statusPill, plan.status === 'paused' && styles.statusPillPaused]}>
              <Text style={[styles.statusText, plan.status === 'paused' && styles.statusTextPaused]}>
                {t(plan.status === 'active' ? 'recurring_plan_status_active' : 'recurring_plan_status_paused')}
              </Text>
            </View>
          </View>
          {plan.expected_amount != null ? (
            <Text style={styles.planAmount}>{formatCurrency(plan.expected_amount, plan.currency)}</Text>
          ) : null}
          <Text style={styles.meta}>
            {recurrenceLabel(plan)} · {formatDateFull(plan.next_due_date, t)}
          </Text>
          <View style={styles.preferenceRow}>
            <MaterialCommunityIcons name="bell-outline" size={14} color={Colors.textSecondary} />
            <Text style={styles.preferenceText}>
              {plan.reminder_days_before === 0
                ? t('recurring_plan_preference_same_day', { time: plan.reminder_time })
                : t('recurring_plan_preference_saved', {
                    days: plan.reminder_days_before,
                    time: plan.reminder_time,
                  })}
            </Text>
          </View>
        </View>
      </View>
      <View style={styles.planActions}>
        <Pressable
          accessibilityRole="button"
          accessibilityLabel={t('edit')}
          onPress={() => openEditPlan(plan)}
          style={({ pressed }) => [styles.iconAction, pressed && styles.actionPressed]}
        >
          <MaterialCommunityIcons name="pencil-outline" size={18} color={Colors.textSecondary} />
        </Pressable>
        <Pressable
          accessibilityRole="button"
          accessibilityLabel={t(plan.status === 'active' ? 'recurring_plan_pause' : 'recurring_plan_resume')}
          onPress={() => void togglePlan(plan)}
          style={({ pressed }) => [styles.iconAction, pressed && styles.actionPressed]}
        >
          <MaterialCommunityIcons
            name={plan.status === 'active' ? 'pause' : 'play'}
            size={19}
            color={Colors.textSecondary}
          />
        </Pressable>
        <Pressable
          accessibilityRole="button"
          accessibilityLabel={t('delete')}
          onPress={() => setDeletePlan(plan)}
          style={({ pressed }) => [styles.iconAction, pressed && styles.actionPressed]}
        >
          <MaterialCommunityIcons name="trash-can-outline" size={18} color={Colors.danger} />
        </Pressable>
      </View>
    </View>
  );

  const renderItem = (s: SubscriptionWithDetails, isDismissed: boolean) => {
    const days = daysUntil(s.next_expected_date);
    const dueLabel =
      days <= 0
        ? t('subscription_due_today')
        : days === 1
        ? t('subscription_due_tomorrow')
        : t('subscription_due_in_days', { days: days.toString() });
    const dueColor =
      days <= 1 ? Colors.danger : days <= 3 ? Colors.warning : Colors.textMuted;
    const formattedDate = new Intl.DateTimeFormat(intlLocaleForLanguage(language), {
      day: '2-digit',
      month: 'short',
    }).format(new Date(s.next_expected_date + 'T12:00:00'));

    return (
      <Animated.View
        entering={FadeInDown.duration(280)}
        style={[styles.card, isDismissed && styles.cardMuted]}
        key={s.id}
      >
        <View style={styles.cardHeader}>
          <View
            style={[
              styles.iconCircle,
              {
                backgroundColor:
                  (s.category_color || Colors.primary) + (isDismissed ? '14' : '24'),
              },
            ]}
          >
            <MaterialCommunityIcons
              name={(s.category_icon as any) || 'autorenew'}
              size={22}
              color={s.category_color || Colors.primary}
            />
          </View>
          <View style={{ flex: 1 }}>
            <Text style={styles.vendor} numberOfLines={1}>
              {s.vendor_name}
            </Text>
            <Text style={styles.meta}>
              {t(periodLabelKey(s.period_days))} ·{' '}
              {t('subscription_seen_count', { count: String(s.occurrences) })}
            </Text>
          </View>
          <View style={{ alignItems: 'flex-end' }}>
            <Text style={styles.amount}>{formatCurrency(s.amount, s.currency)}</Text>
            <Text style={styles.equivalent}>
              ~{formatCurrency(monthlyEquivalent(s.amount, s.period_days), s.currency)}
              /{t('subscription_per_month_short')}
            </Text>
          </View>
        </View>

        {!isDismissed && (
          <View style={styles.dueRow}>
            <MaterialCommunityIcons name="calendar-clock" size={14} color={dueColor} />
            <Text style={[styles.dueText, { color: dueColor }]}>
              {dueLabel} · {formattedDate}
            </Text>
          </View>
        )}

        <View style={styles.actionsRow}>
          {isDismissed ? (
            <Pressable
              onPress={() => handleRestore(s)}
              style={({ pressed }) => [styles.action, pressed && styles.actionPressed]}
            >
              <MaterialCommunityIcons name="restore" size={16} color={Colors.primary} />
              <Text style={[styles.actionText, { color: Colors.primary }]}>
                {t('subscription_action_restore')}
              </Text>
            </Pressable>
          ) : (
            <>
              <Pressable
                onPress={() => openDetectedPlan(s)}
                style={({ pressed }) => [styles.action, styles.confirmAction, pressed && styles.actionPressed]}
              >
                <MaterialCommunityIcons name="calendar-plus" size={16} color={Colors.primary} />
                <Text style={[styles.actionText, styles.confirmActionText]}>
                  {t('recurring_plan_convert')}
                </Text>
              </Pressable>
              <Pressable
                onPress={() => handleDismiss(s)}
                style={({ pressed }) => [styles.action, pressed && styles.actionPressed]}
              >
                <MaterialCommunityIcons name="close-circle-outline" size={16} color={Colors.textSecondary} />
                <Text style={styles.actionText}>{t('subscription_action_dismiss')}</Text>
              </Pressable>
            </>
          )}
        </View>
      </Animated.View>
    );
  };

  return (
    <SafeAreaView style={styles.container} edges={['top']}>
      <View style={styles.header}>
        <Pressable onPress={() => router.back()} style={styles.backBtn}>
          <MaterialCommunityIcons name="chevron-left" size={26} color={Colors.textPrimary} />
        </Pressable>
        <Text style={styles.title} numberOfLines={1}>
          {t('subscriptions_title')}
        </Text>
        <View style={{ width: 44 }} />
      </View>

      <ScrollView
        contentContainerStyle={styles.scrollContent}
        refreshControl={
          <RefreshControl
            refreshing={refreshing}
            onRefresh={onPullRefresh}
            tintColor={Colors.primary}
            colors={[Colors.primary]}
          />
        }
        showsVerticalScrollIndicator={false}
      >
        <View style={styles.sectionHeader}>
          <View style={styles.sectionHeadingCopy}>
            <Text style={styles.sectionTitle}>{t('recurring_plans_title')}</Text>
            <Text style={styles.sectionHint}>{t('recurring_plans_hint')}</Text>
          </View>
          <Pressable
            testID="recurring-plan-add"
            accessibilityRole="button"
            accessibilityLabel={t('recurring_plan_add_title')}
            onPress={openManualPlan}
            style={({ pressed }) => [styles.addPlanButton, pressed && styles.actionPressed]}
          >
            <MaterialCommunityIcons name="plus" size={20} color={Colors.onPrimary} />
          </Pressable>
        </View>

        {loading ? (
          <View style={styles.loaderWrap}>
            <ActivityIndicator color={Colors.primary} />
          </View>
        ) : plans.length > 0 ? (
          <View style={styles.listWrap}>{plans.map(renderPlan)}</View>
        ) : (
          <Pressable
            accessibilityRole="button"
            onPress={openManualPlan}
            style={({ pressed }) => [styles.planEmpty, pressed && styles.actionPressed]}
          >
            <View style={styles.planEmptyIcon}>
              <MaterialCommunityIcons name="calendar-plus" size={22} color={Colors.primary} />
            </View>
            <View style={styles.planEmptyCopy}>
              <Text style={styles.planEmptyTitle}>{t('recurring_plan_empty_title')}</Text>
              <Text style={styles.planEmptyText}>{t('recurring_plan_empty_hint')}</Text>
            </View>
            <MaterialCommunityIcons name="chevron-right" size={20} color={Colors.textMuted} />
          </Pressable>
        )}

        <View style={styles.detectedHeader}>
          <Text style={styles.sectionTitle}>{t('recurring_detected_title')}</Text>
          <Text style={styles.sectionHint}>{t('recurring_detected_hint')}</Text>
        </View>

        {/* Yalnız gerçekten onay bekleyen tahminler varken özet gösterilir. */}
        {!loading && active.length > 0 ? (
          <Animated.View entering={FadeInDown.duration(400)} style={styles.summaryCard}>
            <Text style={styles.summaryLabel}>{t('subscription_monthly_estimate')}</Text>
            <Text style={styles.summaryAmount}>
              {formatCurrency(monthlyTotal, currency)}
            </Text>
            <Text style={styles.summaryHint}>
              {t('subscription_monthly_hint', { count: active.length.toString() })}
            </Text>
          </Animated.View>
        ) : null}

        {!loading && active.length === 0 ? (
          <View style={styles.emptyWrap}>
            <MaterialCommunityIcons
              name="autorenew"
              size={56}
              color={Colors.textMuted}
            />
            <Text style={styles.emptyTitle}>{t('subscription_empty_title')}</Text>
            <Text style={styles.emptyDesc}>{t('subscription_empty_desc')}</Text>
          </View>
        ) : !loading ? (
          <View style={styles.listWrap}>
            {active.map((s) => renderItem(s, false))}
          </View>
        ) : null}

        {dismissed.length > 0 && (
          <Pressable
            style={styles.toggleDismissed}
            onPress={() => setShowDismissed((v) => !v)}
          >
            <MaterialCommunityIcons
              name={showDismissed ? 'eye-off-outline' : 'eye-outline'}
              size={16}
              color={Colors.textSecondary}
            />
            <Text style={styles.toggleDismissedText}>
              {showDismissed
                ? t('subscription_hide_dismissed')
                : t('subscription_show_dismissed', {
                    count: dismissed.length.toString(),
                  })}
            </Text>
          </Pressable>
        )}

        {showDismissed && dismissed.length > 0 && (
          <View style={styles.listWrap}>
            {dismissed.map((s) => renderItem(s, true))}
          </View>
        )}

        <View style={{ height: 80 }} />
      </ScrollView>

      <GlassDeleteModal
        visible={deletePlan !== null}
        title={t('recurring_plan_delete_title')}
        message={t('recurring_plan_delete_message')}
        onCancel={() => setDeletePlan(null)}
        onDelete={() => void removePlan()}
      />
    </SafeAreaView>
  );
}

const getStyles = () =>
  StyleSheet.create({
    container: { flex: 1, backgroundColor: Colors.background },
    header: {
      flexDirection: 'row',
      alignItems: 'center',
      paddingHorizontal: ScreenPadding.horizontal,
      paddingVertical: Spacing.md,
    },
    backBtn: {
      width: 44,
      height: 44,
      borderRadius: 22,
      backgroundColor: Colors.surface,
      borderWidth: 1,
      borderColor: Colors.border,
      alignItems: 'center',
      justifyContent: 'center',
    },
    title: {
      ...Typography.headlineLarge,
      color: Colors.textPrimary,
      flex: 1,
      textAlign: 'center',
    },
    scrollContent: {
      paddingHorizontal: ScreenPadding.horizontal,
      paddingBottom: Spacing.xxl,
    },
    sectionHeader: {
      flexDirection: 'row',
      alignItems: 'center',
      gap: Spacing.md,
      marginBottom: Spacing.md,
    },
    sectionHeadingCopy: { flex: 1, minWidth: 0 },
    sectionTitle: {
      ...Typography.labelLarge,
      color: Colors.textPrimary,
      fontFamily: FontFamily.bold,
      letterSpacing: 0.6,
      textTransform: 'uppercase',
    },
    sectionHint: {
      ...Typography.bodySmall,
      color: Colors.textSecondary,
      marginTop: 3,
    },
    addPlanButton: {
      width: 44,
      height: 44,
      borderRadius: 22,
      alignItems: 'center',
      justifyContent: 'center',
      backgroundColor: Colors.primaryAction,
    },
    detectedHeader: { marginTop: Spacing.xl, marginBottom: Spacing.md },
    planEmpty: {
      minHeight: 88,
      flexDirection: 'row',
      alignItems: 'center',
      gap: Spacing.md,
      borderRadius: BorderRadius.xl,
      borderWidth: 1,
      borderStyle: 'dashed',
      borderColor: Colors.primary + '55',
      backgroundColor: Colors.primary + '0B',
      padding: Spacing.md,
    },
    planEmptyIcon: {
      width: 44,
      height: 44,
      borderRadius: 22,
      alignItems: 'center',
      justifyContent: 'center',
      backgroundColor: Colors.primary + '18',
    },
    planEmptyCopy: { flex: 1, minWidth: 0 },
    planEmptyTitle: {
      ...Typography.labelLarge,
      color: Colors.textPrimary,
      fontFamily: FontFamily.bold,
    },
    planEmptyText: { ...Typography.bodySmall, color: Colors.textSecondary, marginTop: 2 },
    planCard: {
      borderRadius: BorderRadius.xl,
      borderWidth: 1,
      borderColor: Colors.cardBorder,
      backgroundColor: Colors.cardSurface,
      padding: Spacing.md,
    },
    planTopRow: { flexDirection: 'row', alignItems: 'flex-start', gap: Spacing.md },
    planIcon: {
      width: 44,
      height: 44,
      borderRadius: 22,
      alignItems: 'center',
      justifyContent: 'center',
      backgroundColor: Colors.primary + '18',
    },
    planMain: { flex: 1, minWidth: 0 },
    planTitleRow: { flexDirection: 'row', alignItems: 'flex-start', gap: Spacing.sm },
    planTitle: {
      ...Typography.bodyLarge,
      color: Colors.textPrimary,
      fontFamily: FontFamily.semiBold,
      flex: 1,
      minWidth: 0,
    },
    statusPill: {
      paddingHorizontal: Spacing.sm,
      paddingVertical: 3,
      borderRadius: BorderRadius.round,
      backgroundColor: Colors.primary + '18',
    },
    statusPillPaused: { backgroundColor: Colors.surfaceLight },
    statusText: { ...Typography.labelSmall, color: Colors.primary, fontFamily: FontFamily.bold },
    statusTextPaused: { color: Colors.textSecondary },
    planAmount: {
      ...Typography.headlineSmall,
      color: Colors.textPrimary,
      fontFamily: FontFamily.bold,
      marginTop: 4,
    },
    preferenceRow: { flexDirection: 'row', alignItems: 'center', gap: 5, marginTop: Spacing.sm },
    preferenceText: { ...Typography.labelSmall, color: Colors.textSecondary, flex: 1 },
    planActions: {
      flexDirection: 'row',
      justifyContent: 'flex-end',
      gap: Spacing.sm,
      marginTop: Spacing.sm,
      paddingTop: Spacing.sm,
      borderTopWidth: StyleSheet.hairlineWidth,
      borderTopColor: Colors.divider,
    },
    iconAction: {
      width: 44,
      height: 40,
      alignItems: 'center',
      justifyContent: 'center',
      borderRadius: BorderRadius.round,
      backgroundColor: Colors.surfaceLight,
    },
    summaryCard: {
      backgroundColor: Colors.cardSurface,
      borderRadius: BorderRadius.xl,
      padding: Spacing.lg,
      marginBottom: Spacing.lg,
      borderWidth: 1,
      borderColor: Colors.cardBorder,
      alignItems: 'center',
    },
    summaryLabel: {
      ...Typography.labelSmall,
      color: Colors.textSecondary,
      letterSpacing: 1,
      textTransform: 'uppercase',
    },
    summaryAmount: {
      ...Typography.displayMedium,
      color: Colors.primary,
      marginVertical: Spacing.sm,
      fontFamily: FontFamily.extraBold,
    },
    summaryHint: {
      ...Typography.bodySmall,
      color: Colors.textMuted,
      textAlign: 'center',
    },
    loaderWrap: { paddingVertical: Spacing.xxl, alignItems: 'center' },
    emptyWrap: {
      alignItems: 'center',
      paddingVertical: Spacing.xxl,
      gap: Spacing.md,
    },
    emptyTitle: {
      ...Typography.headlineSmall,
      color: Colors.textPrimary,
      fontFamily: FontFamily.bold,
      textAlign: 'center',
    },
    emptyDesc: {
      ...Typography.bodyMedium,
      color: Colors.textSecondary,
      textAlign: 'center',
      paddingHorizontal: Spacing.lg,
    },
    listWrap: { gap: Spacing.md },
    card: {
      backgroundColor: Colors.cardSurface,
      borderRadius: BorderRadius.xl,
      padding: Spacing.lg,
      borderWidth: 1,
      borderColor: Colors.cardBorder,
    },
    cardMuted: { opacity: 0.7 },
    cardHeader: {
      flexDirection: 'row',
      alignItems: 'center',
      gap: Spacing.md,
    },
    iconCircle: {
      width: 44,
      height: 44,
      borderRadius: 22,
      alignItems: 'center',
      justifyContent: 'center',
    },
    vendor: {
      ...Typography.bodyLarge,
      color: Colors.textPrimary,
      fontFamily: FontFamily.semiBold,
    },
    meta: {
      ...Typography.labelSmall,
      color: Colors.textMuted,
      marginTop: 2,
    },
    amount: {
      ...Typography.headlineSmall,
      color: Colors.textPrimary,
      fontFamily: FontFamily.extraBold,
      fontSize: 17,
    },
    equivalent: {
      ...Typography.labelSmall,
      color: Colors.textSecondary,
      marginTop: 2,
    },
    dueRow: {
      flexDirection: 'row',
      alignItems: 'center',
      gap: 6,
      marginTop: Spacing.md,
      paddingTop: Spacing.sm,
      borderTopWidth: StyleSheet.hairlineWidth,
      borderTopColor: Colors.divider,
    },
    dueText: {
      ...Typography.labelSmall,
      fontFamily: FontFamily.semiBold,
    },
    actionsRow: {
      flexDirection: 'row',
      justifyContent: 'flex-end',
      flexWrap: 'wrap',
      marginTop: Spacing.sm,
      gap: Spacing.sm,
    },
    action: {
      flexDirection: 'row',
      alignItems: 'center',
      gap: 4,
      paddingHorizontal: Spacing.md,
      paddingVertical: Spacing.xs,
      borderRadius: BorderRadius.round,
      backgroundColor: Colors.surfaceLight,
    },
    actionPressed: { opacity: 0.7 },
    actionText: {
      ...Typography.labelSmall,
      color: Colors.textSecondary,
      fontFamily: FontFamily.semiBold,
    },
    confirmAction: { backgroundColor: Colors.primary + '18' },
    confirmActionText: { color: Colors.primary },
    toggleDismissed: {
      flexDirection: 'row',
      alignItems: 'center',
      justifyContent: 'center',
      gap: 6,
      marginTop: Spacing.lg,
      marginBottom: Spacing.md,
      paddingVertical: Spacing.sm,
    },
    toggleDismissedText: {
      ...Typography.labelMedium,
      color: Colors.textSecondary,
      fontFamily: FontFamily.semiBold,
    },
  });
