import React, { useMemo } from 'react';
import { Pressable, StyleSheet, Text, View } from 'react-native';
import { MaterialCommunityIcons } from '@expo/vector-icons';

import type { SavingsGoalRow } from '../db/goalDao';
import { useCurrency } from '../context/CurrencyContext';
import { useLanguage } from '../i18n/LanguageContext';
import { formatCurrency } from '../utils/formatCurrency';
import { getSavingsGoalProgress } from '../utils/savingsGoalProgress';
import { Colors } from '../theme/colors';
import { useAppTheme, useThemeRevision } from '../theme/themeStore';
import { Typography, FontFamily } from '../theme/typography';
import { Spacing, BorderRadius } from '../theme/spacing';
import AnimatedCard from './AnimatedCard';

type Props = {
  goal: SavingsGoalRow;
  onOpen: () => void;
  onContribute: () => void;
  now?: Date;
};

export default function SavingsGoalPulseCard({ goal, onOpen, onContribute, now }: Props) {
  const scheme = useAppTheme();
  const themeRevision = useThemeRevision();
  const styles = useMemo(() => getStyles(), [scheme, themeRevision]);
  const { t } = useLanguage();
  const { currency } = useCurrency();
  const progress = getSavingsGoalProgress(goal, now);
  const displayCurrency = goal.currency || currency;
  const title = goal.title || t('savings_goal_untitled');

  const statusText = progress.status === 'reached'
    ? t('goal_focus_reached')
    : progress.status === 'overdue'
      ? t('savings_goal_days_passed', { days: String(Math.abs(progress.daysLeft)) })
      : progress.status === 'due_today'
        ? t('savings_goal_deadline_today')
        : t('savings_goal_days_left', { days: String(progress.daysLeft) });

  const remainingText = progress.reached
    ? statusText
    : `${t('goal_focus_remaining', {
      amount: formatCurrency(progress.remaining, displayCurrency),
    })} · ${statusText}`;

  return (
    <AnimatedCard delay={70} style={styles.card}>
      <View style={styles.row} testID="goal-pulse-card">
        <Pressable
          testID="goal-pulse-open"
          onPress={onOpen}
          style={({ pressed }) => [styles.mainButton, pressed && styles.pressed]}
          accessibilityRole="button"
          accessibilityLabel={t('goal_focus_a11y', {
            title,
            percent: String(progress.percent),
            saved: formatCurrency(progress.saved, displayCurrency),
            target: formatCurrency(progress.target, displayCurrency),
            status: remainingText,
          })}
          accessibilityHint={t('goal_focus_open_hint')}
        >
          <View style={styles.headingRow}>
            <View style={styles.iconWrap}>
              <MaterialCommunityIcons name="flag-checkered" size={18} color={Colors.primary} />
            </View>
            <View style={styles.headingText}>
              <Text style={styles.kicker}>{t('savings_goal_kicker')}</Text>
              <Text style={styles.title} numberOfLines={2}>{title}</Text>
            </View>
            <View style={styles.percentPill}>
              <Text style={styles.percentText}>{progress.percent}%</Text>
            </View>
          </View>

          <View style={styles.progressTrack}>
            <View
              testID="goal-pulse-progress"
              style={[styles.progressFill, { width: `${progress.percent}%` }]}
            />
          </View>

          <View style={styles.detailsRow}>
            <Text style={styles.amountText}>
              {formatCurrency(progress.saved, displayCurrency)}
              <Text style={styles.amountMuted}>
                {' / '}{formatCurrency(progress.target, displayCurrency)}
              </Text>
            </Text>
            <View style={styles.statusRow}>
              <MaterialCommunityIcons
                name={progress.status === 'overdue' ? 'alert-circle-outline' : 'calendar-clock'}
                size={14}
                color={progress.status === 'overdue' ? Colors.warning : Colors.textSecondary}
              />
              <Text
                style={[
                  styles.statusText,
                  progress.status === 'overdue' && styles.statusTextWarning,
                ]}
              >
                {remainingText}
              </Text>
            </View>
          </View>
        </Pressable>

        <Pressable
          testID="goal-pulse-contribute"
          onPress={onContribute}
          hitSlop={6}
          style={({ pressed }) => [styles.contributeButton, pressed && styles.contributePressed]}
          accessibilityRole="button"
          accessibilityLabel={t('goal_add_contribution')}
        >
          <MaterialCommunityIcons name="plus" size={22} color={Colors.primary} />
        </Pressable>
      </View>
    </AnimatedCard>
  );
}

const getStyles = () => StyleSheet.create({
  card: {
    padding: 0,
    marginTop: Spacing.md,
    overflow: 'hidden',
  },
  row: {
    flexDirection: 'row',
    alignItems: 'stretch',
  },
  mainButton: {
    flex: 1,
    minWidth: 0,
    padding: Spacing.lg,
    paddingRight: Spacing.md,
  },
  pressed: {
    opacity: 0.82,
  },
  headingRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: Spacing.sm,
  },
  iconWrap: {
    width: 36,
    height: 36,
    borderRadius: 18,
    backgroundColor: Colors.primaryGlow,
    alignItems: 'center',
    justifyContent: 'center',
  },
  headingText: {
    flex: 1,
    minWidth: 0,
  },
  kicker: {
    ...Typography.labelSmall,
    color: Colors.primary,
    fontFamily: FontFamily.extraBold,
    letterSpacing: 1.2,
    textTransform: 'uppercase',
  },
  title: {
    ...Typography.labelLarge,
    color: Colors.textPrimary,
    fontFamily: FontFamily.bold,
    marginTop: 1,
  },
  percentPill: {
    minWidth: 46,
    alignItems: 'center',
    paddingHorizontal: Spacing.sm,
    paddingVertical: 4,
    borderRadius: BorderRadius.round,
    backgroundColor: Colors.primaryGlow,
    borderWidth: 1,
    borderColor: Colors.primary + '33',
  },
  percentText: {
    ...Typography.labelMedium,
    color: Colors.primary,
    fontFamily: FontFamily.extraBold,
  },
  progressTrack: {
    height: 6,
    borderRadius: 3,
    backgroundColor: Colors.surfaceLight,
    overflow: 'hidden',
    marginTop: Spacing.md,
  },
  progressFill: {
    height: '100%',
    borderRadius: 3,
    backgroundColor: Colors.primary,
  },
  detailsRow: {
    marginTop: Spacing.sm,
    gap: 3,
  },
  amountText: {
    ...Typography.labelMedium,
    color: Colors.textPrimary,
    fontFamily: FontFamily.bold,
  },
  amountMuted: {
    color: Colors.textSecondary,
    fontFamily: FontFamily.medium,
  },
  statusRow: {
    flexDirection: 'row',
    alignItems: 'flex-start',
    flexWrap: 'wrap',
    gap: 5,
  },
  statusText: {
    ...Typography.bodySmall,
    color: Colors.textSecondary,
    flex: 1,
    minWidth: 0,
  },
  statusTextWarning: {
    color: Colors.warning,
    fontFamily: FontFamily.semiBold,
  },
  contributeButton: {
    width: 52,
    minHeight: 52,
    alignItems: 'center',
    justifyContent: 'center',
    borderLeftWidth: 1,
    borderLeftColor: Colors.divider,
    backgroundColor: Colors.primaryGlow,
  },
  contributePressed: {
    opacity: 0.7,
    backgroundColor: Colors.primary + '20',
  },
});
