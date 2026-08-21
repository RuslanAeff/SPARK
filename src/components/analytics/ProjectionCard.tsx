// S.P.A.R.K. — Analiz kartı: Ay sonu projeksiyonu (tahmini harcama + bütçe pisti)
import React from 'react';
import { View, Text } from 'react-native';
import { MaterialCommunityIcons } from '@expo/vector-icons';
import AnimatedCard from '../AnimatedCard';
import { Colors } from '../../theme/colors';
import { useThemeRevision } from '../../theme/themeStore';
import { formatCurrency } from '../../utils/formatCurrency';
import type { BaseCardProps, ProjectionInfo, Timeframe } from './shared';

interface ProjectionCardProps extends BaseCardProps {
  projectionInfo: ProjectionInfo;
  timeframe: Timeframe;
}

function ProjectionCard({ styles, t, currency, projectionInfo, timeframe }: ProjectionCardProps) {
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
            <MaterialCommunityIcons name="crystal-ball" size={18} color={Colors.textSecondary} />
            <Text style={styles.cardHeaderTitle}>{t('projection_title')}</Text>
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

  // Pist üzerinde işaretler — bütçe varsa bütçe = %100 gibi normalize edilir.
  const refValue = Math.max(effectiveBudget, projected, currentSpent, 1);
  const currentPct = Math.min(100, (currentSpent / refValue) * 100);
  const projectedPct = Math.min(100, (projected / refValue) * 100);
  const budgetPct = effectiveBudget > 0 ? Math.min(100, (effectiveBudget / refValue) * 100) : null;

  // Outcome metni: yüzde yerine somut TL — kullanıcı için çok daha net.
  const outcomeIcon =
    status === 'over' ? 'alert-circle-outline' :
    status === 'safe' ? 'shield-check-outline' :
    status === 'warn' ? 'target' :
    'wallet-plus-outline';
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
    <AnimatedCard delay={120} style={{ ...styles.section, ...styles.primaryCard }}>
      <View style={styles.projHeader}>
        <View style={styles.projHeaderLeft}>
          <View style={[styles.projHeaderIcon, { backgroundColor: accent + '1F' }]}>
            <MaterialCommunityIcons name="crystal-ball" size={16} color={accent} />
          </View>
          <View style={styles.projHeaderTitleWrap}>
            <Text style={styles.cardHeaderTitle}>{t(titleKey)}</Text>
            {periodLabel && <Text style={styles.projPeriodLabel}>{periodLabel}</Text>}
          </View>
        </View>
        <View style={[styles.projDaysChip, { backgroundColor: Colors.surfaceLight }]}>
          <MaterialCommunityIcons name="calendar-blank-outline" size={12} color={Colors.textSecondary} />
          <Text style={styles.projDaysChipText}>{t('projection_days_left', { days: daysLeft.toString() })}</Text>
        </View>
      </View>

      {/* Hero: tahmini ay sonu */}
      <Text style={styles.projHeroLabel}>{t(estimatedKey)}</Text>
      <Text style={[styles.projHeroValue, { color: accent }]} numberOfLines={1} adjustsFontSizeToFit minimumFontScale={0.7}>
        {formatCurrency(projected, currency)}
      </Text>
      <Text style={styles.projPaceHint}>{t('projection_pace_hint')}</Text>

      {/* Track — current ↔ projected ↔ budget */}
      <View style={styles.projTrackWrap}>
        <View style={styles.projTrack}>
          <View style={styles.projTrackFillClip}>
            <View style={[styles.projTrackCurrent, { width: `${currentPct}%`, backgroundColor: accent }]} />
            <View
              style={[
                styles.projTrackProjected,
                {
                  left: `${currentPct}%`,
                  width: `${Math.max(0, projectedPct - currentPct)}%`,
                  backgroundColor: accent + '4D',
                },
              ]}
            />
          </View>
          {/* Budget marker */}
          {budgetPct !== null && (
            <View testID="projection-budget-marker" style={[
              styles.projTrackBudgetMarker,
              { left: `${Math.max(1, Math.min(99, budgetPct))}%` },
            ]} />
          )}
        </View>
        <View style={styles.projTrackLegend}>
          <View style={styles.projLegendItem}>
            <View style={[styles.projLegendDot, { backgroundColor: accent }]} />
            <Text style={styles.projLegendText}>{t('projection_so_far')}</Text>
          </View>
          <View style={styles.projLegendItem}>
            <View style={[styles.projLegendDot, { backgroundColor: accent + '4D' }]} />
            <Text style={styles.projLegendText}>{t(estimatedKey)}</Text>
          </View>
          {budgetPct !== null && (
            <View style={styles.projLegendItem}>
              <View style={[styles.projLegendDot, styles.projLegendDotBudget]} />
              <Text style={styles.projLegendText}>{t('budget_overview').toLowerCase()}</Text>
            </View>
          )}
        </View>
      </View>

      {/* Outcome panel — tam genişlik, 2 satır, somut tutar */}
      <View style={[styles.projOutcomePanel, { backgroundColor: accent + '14', borderColor: accent + '33' }]}>
        <View style={[styles.projOutcomeIconWrap, { backgroundColor: accent + '22' }]}>
          <MaterialCommunityIcons name={outcomeIcon as any} size={18} color={accent} />
        </View>
        <View style={styles.projOutcomeTextWrap}>
          <Text style={[styles.projOutcomeTitle, { color: accent }]} numberOfLines={1}>
            {outcomeTitle}
          </Text>
          <Text style={styles.projOutcomeSub} numberOfLines={2}>
            {outcomeSub}
          </Text>
        </View>
      </View>

      {/* Pace satırı */}
      <View style={styles.projPaceRow}>
        <View style={styles.projPaceRowLeft}>
          <MaterialCommunityIcons name="speedometer" size={13} color={Colors.textSecondary} />
          <Text style={styles.projPaceLabel}>{t('projection_daily_pace')}</Text>
        </View>
        <Text style={styles.projPaceValue}>{formatCurrency(dailyPace, currency, false)}</Text>
      </View>

      {/* Aykırı değer notu: tek seferlik büyük harcama trimmed pace ile tahminden ayıklandı */}
      {hasOutlier && (
        <View style={styles.projOutlierNote}>
          <MaterialCommunityIcons name="information-outline" size={12} color={Colors.textMuted} />
          <Text style={styles.projOutlierNoteText} numberOfLines={2}>{t('projection_outlier_note')}</Text>
        </View>
      )}
    </AnimatedCard>
  );
}

export default React.memo(ProjectionCard);
