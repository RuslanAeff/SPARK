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
import { useAppTheme } from '../src/theme/themeStore';
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

function daysUntil(dateIso: string): number {
  const target = new Date(dateIso + 'T12:00:00').getTime();
  const today = new Date();
  today.setHours(0, 0, 0, 0);
  return Math.ceil((target - today.getTime()) / (86400 * 1000));
}

export default function SubscriptionsScreen() {
  const scheme = useAppTheme();
  const styles = useMemo(() => getStyles(), [scheme]);
  const router = useRouter();
  const { t, language } = useLanguage();
  const { currency } = useCurrency();
  const [items, setItems] = useState<SubscriptionWithDetails[]>([]);
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [showDismissed, setShowDismissed] = useState(false);

  const refresh = useCallback(async () => {
    try {
      await syncSubscriptions();
      const list = await SubscriptionDao.getAll();
      setItems(list);
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

  const active = items.filter((s) => s.status === 'active');
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
  }
  async function handleRestore(s: SubscriptionWithDetails) {
    Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);
    await SubscriptionDao.setStatus(s.vendor_id, 'active');
    SparkToast.show(t('subscription_restored'), 'success', s.vendor_name);
    await refresh();
  }

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
            <Text style={styles.amount}>{formatCurrency(s.amount, currency)}</Text>
            <Text style={styles.equivalent}>
              ~{formatCurrency(monthlyEquivalent(s.amount, s.period_days), currency)}
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
            <Pressable
              onPress={() => handleDismiss(s)}
              style={({ pressed }) => [styles.action, pressed && styles.actionPressed]}
            >
              <MaterialCommunityIcons name="close-circle-outline" size={16} color={Colors.textSecondary} />
              <Text style={styles.actionText}>{t('subscription_action_dismiss')}</Text>
            </Pressable>
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
        {/* Summary kartı */}
        <Animated.View entering={FadeInDown.duration(400)} style={styles.summaryCard}>
          <Text style={styles.summaryLabel}>{t('subscription_monthly_estimate')}</Text>
          <Text style={styles.summaryAmount}>
            {formatCurrency(monthlyTotal, currency)}
          </Text>
          <Text style={styles.summaryHint}>
            {t('subscription_monthly_hint', { count: active.length.toString() })}
          </Text>
        </Animated.View>

        {loading ? (
          <View style={styles.loaderWrap}>
            <ActivityIndicator color={Colors.primary} />
          </View>
        ) : active.length === 0 ? (
          <View style={styles.emptyWrap}>
            <MaterialCommunityIcons
              name="autorenew"
              size={56}
              color={Colors.textMuted}
            />
            <Text style={styles.emptyTitle}>{t('subscription_empty_title')}</Text>
            <Text style={styles.emptyDesc}>{t('subscription_empty_desc')}</Text>
          </View>
        ) : (
          <View style={styles.listWrap}>
            {active.map((s) => renderItem(s, false))}
          </View>
        )}

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
