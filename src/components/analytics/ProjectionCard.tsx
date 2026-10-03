// S.P.A.R.K. — Analiz kartı: Ay sonu projeksiyonu (tahmini harcama ve bütçe karşılaştırması)
import React from 'react';
import { View, Text } from 'react-native';
import { MaterialCommunityIcons } from '@expo/vector-icons';
import AnimatedCard from '../AnimatedCard';
import { Colors } from '../../theme/colors';
import { useAppTheme, useThemeRevision } from '../../theme/themeStore';
import { formatCurrency } from '../../utils/formatCurrency';
import type { BaseCardProps, ProjectionInfo, Timeframe } from './shared';

interface ProjectionCardProps extends BaseCardProps {
  projectionInfo: ProjectionInfo;
  timeframe: Timeframe;
}

function ProjectionCard({ styles, t, currency, projectionInfo, timeframe }: ProjectionCardProps) {
  useAppTheme();
  useThemeRevision();
  // Yıllık analizde ay sonu projeksiyonu anlamlı bir kart değildir. Kart
  // yapılandırmasını koruyup yalnızca bu görünümde render etmeyiz.
  if (timeframe === 'year') return null;

  if (!projectionInfo.available) {
    const reasonKey = projectionInfo.reason === 'only_month' ? 'projection_only_month' : 'projection_too_early';
    const icon = projectionInfo.reason === 'only_month' ? 'calendar-month-outline' : 'progress-clock';
    return (
      <AnimatedCard delay={120} style={styles.section}>
        <View style={styles.projHeader}>
          <View style={styles.projHeaderLeft}>
            <MaterialCommunityIcons name="chart-line" size={18} color={Colors.textSecondary} />
            <Text style={styles.projTitle}>{t('projection_title')}</Text>
          </View>
        </View>
        <View style={styles.projEmptyWrap}>
          <MaterialCommunityIcons name={icon} size={36} color={Colors.textMuted} />
          <Text style={styles.projEmptyText}>{t(reasonKey)}</Text>
        </View>
      </AnimatedCard>
    );
  }

  const { projected, currentSpent, dailyPace, daysLeft, effectiveBudget, status, hasOutlier, periodLabel, isCycle } = projectionInfo;
  // Döngü başlangıcı 1 değilse pencere takvim ayı değil → metinler "dönem" der.
  const titleKey = isCycle ? 'projection_title_cycle' : 'projection_title';
  const estimatedKey = isCycle ? 'projection_estimated_cycle' : 'projection_estimated';
  const accent =
    status === 'over' ? Colors.danger :
    status === 'warn' ? Colors.warning :
    status === 'safe' ? Colors.success :
    Colors.primary;

  let outcomeTitle: string;
  let outcomeSub: string;
  if (status === 'safe') {
    const remaining = effectiveBudget - projected;
    outcomeTitle = t('projection_outcome_save_title');
    outcomeSub = t('projection_outcome_save_sub', { amount: formatCurrency(remaining, currency, false) });
  } else if (status === 'over') {
    const overBy = projected - effectiveBudget;
    outcomeTitle = t('projection_outcome_over_title');
    outcomeSub = t('projection_outcome_over_sub', { amount: formatCurrency(overBy, currency, false) });
  } else if (status === 'warn') {
    outcomeTitle = t('projection_outcome_warn_title');
    outcomeSub = t(isCycle ? 'projection_outcome_warn_sub_cycle' : 'projection_outcome_warn_sub');
  } else {
    outcomeTitle = t('projection_outcome_nobudget_title');
    outcomeSub = t('projection_outcome_nobudget_sub');
  }

  return (
    <AnimatedCard delay={120} style={styles.section}>
      <View style={styles.projHeader}>
        <Text style={styles.projTitle}>{t(titleKey)}</Text>
        <View style={styles.projMetaRow}>
          {periodLabel ? <Text style={styles.projPeriodLabel}>{periodLabel}</Text> : null}
          <Text style={styles.projDaysChipText}>{t('projection_days_left', { days: String(daysLeft) })}</Text>
        </View>
      </View>

      {/* Hero: tahmini ay sonu */}
      <Text style={styles.projHeroLabel}>{t(estimatedKey)}</Text>
      <Text style={styles.projHeroValue} numberOfLines={1} adjustsFontSizeToFit minimumFontScale={0.7}>
        {formatCurrency(projected, currency)}
      </Text>
      <Text style={styles.projPaceHint}>{t('projection_pace_hint')}</Text>

      <View style={styles.projMetrics}>
        <View style={styles.projMetric}>
          <Text style={styles.projMetricLabel}>{t('projection_so_far')}</Text>
          <Text style={styles.projMetricValue}>{formatCurrency(currentSpent, currency)}</Text>
        </View>
        <View style={styles.projMetric}>
          <Text style={styles.projMetricLabel}>{t('projection_budget_label')}</Text>
          <Text style={styles.projMetricValue}>
            {effectiveBudget > 0 ? formatCurrency(effectiveBudget, currency) : t('projection_no_budget')}
          </Text>
        </View>
      </View>

      <View style={[styles.projOutcomePanel, { borderLeftColor: accent }]}>
        <Text style={[styles.projOutcomeTitle, { color: accent }]}>{outcomeTitle}</Text>
        <Text style={styles.projOutcomeSub}>{outcomeSub}</Text>
      </View>

      {/* Pace satırı */}
      <View style={styles.projPaceRow}>
        <View style={styles.projPaceRowLeft}>
          <MaterialCommunityIcons name="speedometer" size={13} color={Colors.textSecondary} />
          <Text style={styles.projPaceLabel}>{t('projection_daily_pace')}</Text>
        </View>
        <Text style={styles.projPaceValue}>{formatCurrency(dailyPace, currency, false)}</Text>
      </View>

      {/* Günlük tempo düzeltmesi gerçek harcanan tutarı değiştirmez. */}
      {hasOutlier && (
        <View style={styles.projOutlierNote}>
          <MaterialCommunityIcons name="information-outline" size={12} color={Colors.textMuted} />
          <Text style={styles.projOutlierNoteText}>{t('projection_outlier_note')}</Text>
        </View>
      )}
    </AnimatedCard>
  );
}

export default React.memo(ProjectionCard);
