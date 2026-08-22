// S.P.A.R.K. — Analiz kartı: Birikim hedefi ilerlemesi (donut + outcome paneli)
import React from 'react';
import { View, Text } from 'react-native';
import { MaterialCommunityIcons } from '@expo/vector-icons';
import AnimatedCard from '../AnimatedCard';
import DonutChart from '../DonutChart';
import { Colors } from '../../theme/colors';
import { useThemeRevision } from '../../theme/themeStore';
import { formatCurrency } from '../../utils/formatCurrency';
import type { BaseCardProps, GoalInfo } from './shared';

interface GoalCardProps extends BaseCardProps {
  goalInfo: GoalInfo;
}

function GoalCard({ styles, t, currency, goalInfo }: GoalCardProps) {
  useThemeRevision();
  if (!goalInfo.available) return null;

  const { title, target, current, remaining, ratio, pctNum, daysToTarget, monthlyNeed, status } = goalInfo;
  const accent =
    status === 'complete' ? Colors.success :
    status === 'overdue' ? Colors.danger :
    status === 'tight' ? Colors.warning :
    Colors.primary;
  const goalSegments = [
    { value: ratio, label: 'progress', color: accent },
    { value: 1 - ratio, label: 'remaining', color: Colors.surfaceLight },
  ];
  const dateText =
    status === 'complete' ? '' :
    daysToTarget < 0 ? t('goal_card_days_overdue', { days: Math.abs(daysToTarget).toString() }) :
    daysToTarget === 0 ? t('goal_card_due_today') :
    t('goal_card_days_left', { days: daysToTarget.toString() });
  const subText =
    status === 'complete'
      ? t('goal_card_complete_sub', { amount: formatCurrency(current, currency, false) })
      : status === 'overdue'
      ? t('goal_card_overdue_sub', { amount: formatCurrency(remaining, currency, false) })
      : status === 'tight'
      ? t('goal_card_monthly_need', { amount: formatCurrency(monthlyNeed, currency, false) })
      : t('goal_card_monthly_safe', { amount: formatCurrency(monthlyNeed, currency, false) });
  const subIcon =
    status === 'complete' ? 'trophy-outline' :
    status === 'overdue' ? 'alert-circle-outline' :
    status === 'tight' ? 'rocket-launch-outline' :
    'piggy-bank-outline';

  return (
    <AnimatedCard delay={140} style={{ ...styles.section, ...styles.primaryCard }}>
      <View style={styles.goalHeader}>
        <View style={styles.goalHeaderLeft}>
          <View style={[styles.goalHeaderIcon, { backgroundColor: accent + '1F' }]}>
            <MaterialCommunityIcons name="flag-checkered" size={16} color={accent} />
          </View>
          <Text style={styles.cardHeaderTitle}>{t('goal_card_title')}</Text>
        </View>
        {!!dateText && (
          <View style={[styles.goalDateChip, { backgroundColor: Colors.surfaceLight }]}>
            <MaterialCommunityIcons name="calendar-blank-outline" size={12} color={Colors.textSecondary} />
            <Text style={styles.goalDateChipText}>{dateText}</Text>
          </View>
        )}
      </View>

      {!!title && <Text style={styles.goalTitle} numberOfLines={1}>{title}</Text>}

      <View style={styles.goalBody}>
        <View style={styles.goalDonutWrap}>
          <DonutChart
            segments={goalSegments}
            size={140}
            strokeWidth={14}
            innerContent={
              <View style={styles.goalDonutCenter}>
                <Text style={[styles.goalDonutPct, { color: accent }]}>{pctNum}%</Text>
                <Text style={styles.goalDonutLabel}>{t('goal_card_saved_label').toLowerCase()}</Text>
              </View>
            }
          />
        </View>
        <View style={styles.goalStats}>
          <View style={styles.goalStatRow}>
            <View style={[styles.goalStatDot, { backgroundColor: accent }]} />
            <Text style={styles.goalStatLabel}>{t('goal_card_saved_label')}</Text>
            <Text style={styles.goalStatValue}>{formatCurrency(current, currency, false)}</Text>
          </View>
          <View style={styles.goalStatRow}>
            <View style={[styles.goalStatDot, { backgroundColor: Colors.surfaceLight, borderColor: Colors.border, borderWidth: 1 }]} />
            <Text style={styles.goalStatLabel}>{t('goal_card_remaining_label')}</Text>
            <Text style={styles.goalStatValue}>{formatCurrency(remaining, currency, false)}</Text>
          </View>
          <View style={styles.goalStatRow}>
            <MaterialCommunityIcons name="target" size={10} color={Colors.textMuted} style={{ marginHorizontal: 1 }} />
            <Text style={styles.goalStatLabel}>{t('goal_card_target_label')}</Text>
            <Text style={styles.goalStatValue}>{formatCurrency(target, currency, false)}</Text>
          </View>
        </View>
      </View>

      {/* Outcome panel */}
      <View style={[styles.goalOutcome, { backgroundColor: accent + '14', borderColor: accent + '33' }]}>
        <View style={[styles.goalOutcomeIcon, { backgroundColor: accent + '22' }]}>
          <MaterialCommunityIcons name={subIcon as any} size={16} color={accent} />
        </View>
        <Text style={[styles.goalOutcomeText, { color: status === 'complete' || status === 'overdue' ? accent : Colors.textPrimary }]} numberOfLines={2}>
          {status === 'complete' ? t('goal_card_complete_title') + ' — ' : ''}{subText}
        </Text>
      </View>
    </AnimatedCard>
  );
}

export default React.memo(GoalCard);
