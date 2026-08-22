// S.P.A.R.K. — Analiz kartı: Dönem karşılaştırması (bu dönem vs önceki dönem)
import React from 'react';
import { View, Text } from 'react-native';
import { MaterialCommunityIcons } from '@expo/vector-icons';
import AnimatedCard from '../AnimatedCard';
import { Colors } from '../../theme/colors';
import { useThemeRevision } from '../../theme/themeStore';
import { formatCurrency } from '../../utils/formatCurrency';
import type { AnalyticsDateRange } from '../../utils/analyticsPeriod';
import type { BaseCardProps, Timeframe } from './shared';

interface MonthlyCompareCardProps extends BaseCardProps {
  timeframe: Timeframe;
  status: 'ready' | 'unavailable' | 'no_completed_days';
  currentTotal: number;
  prevTotal: number;
  comparisonDelta: number | null;
  currentRange: AnalyticsDateRange | null;
  previousRange: AnalyticsDateRange | null;
}

const formatRange = (range: AnalyticsDateRange | null): string => {
  if (!range) return '—';
  const formatDate = (value: string) => value.split('-').reverse().join('.');
  return `${formatDate(range.start)} – ${formatDate(range.end)}`;
};

function MonthlyCompareCard({
  styles, t, currency, timeframe, status, currentTotal, prevTotal, comparisonDelta,
  currentRange, previousRange,
}: MonthlyCompareCardProps) {
  useThemeRevision();
  if (timeframe === 'year') return null;
  const ready = status === 'ready';
  return (
    <AnimatedCard delay={150} style={styles.section}>
      <Text style={styles.sectionTitle}>{t('monthly_comparison')}</Text>
      <View style={styles.compareRow}>
        <View style={styles.compareBlock}>
          <Text style={styles.compareLabel}>{t('this_period')}</Text>
          <Text style={styles.compareValue}>
            {ready ? formatCurrency(currentTotal, currency) : '—'}
          </Text>
          <Text style={styles.compareRangeLabel}>{formatRange(currentRange)}</Text>
        </View>
        <View style={styles.compareDivider} />
        <View style={styles.compareBlock}>
          <Text style={styles.compareLabel}>{t('last_period')}</Text>
          <Text style={[styles.compareValue, { color: Colors.textSecondary }]}>
            {ready ? formatCurrency(prevTotal, currency) : '—'}
          </Text>
          <Text style={styles.compareRangeLabel}>{formatRange(previousRange)}</Text>
        </View>
      </View>
      {!ready ? (
        <View style={styles.deltaBadge}>
          <MaterialCommunityIcons name="information-outline" size={16} color={Colors.textMuted} />
          <Text style={[styles.deltaText, { color: Colors.textMuted }]}>
            {t(status === 'no_completed_days'
              ? 'comparison_no_completed_days'
              : 'comparison_data_unavailable')}
          </Text>
        </View>
      ) : prevTotal === 0 ? (
        <View style={styles.deltaBadge}>
          <MaterialCommunityIcons name="check-circle-outline" size={16} color={Colors.textMuted} />
          <Text style={[styles.deltaText, { color: Colors.textMuted }]}>
            {t('comparison_previous_zero')}
          </Text>
        </View>
      ) : comparisonDelta === 0 ? (
        <View style={styles.deltaBadge}>
          <MaterialCommunityIcons name="minus" size={16} color={Colors.textMuted} />
          <Text style={[styles.deltaText, { color: Colors.textMuted }]}>{t('no_change')}</Text>
        </View>
      ) : comparisonDelta !== null ? (
        <View style={[styles.deltaBadge, { backgroundColor: comparisonDelta <= 0 ? Colors.success + '18' : Colors.danger + '18' }]}>
          <MaterialCommunityIcons
            name={comparisonDelta <= 0 ? 'trending-down' : 'trending-up'}
            size={18}
            color={comparisonDelta <= 0 ? Colors.success : Colors.danger}
          />
          <Text style={[styles.deltaText, { color: comparisonDelta <= 0 ? Colors.success : Colors.danger }]}>
            {comparisonDelta <= 0
              ? t('decreased_pct', { pct: Math.abs(comparisonDelta).toString() })
              : t('increased_pct', { pct: comparisonDelta.toString() })}
          </Text>
          <Text style={styles.deltaHint}>{t('vs_previous')}</Text>
        </View>
      ) : null}
      {/* Mini comparison bars */}
      {ready && prevTotal > 0 && (
        <View style={styles.compareBars}>
          <View style={styles.compareBarRow}>
            <Text style={styles.compareBarLabel}>{t('this_period')}</Text>
            <View style={styles.compareBarTrack}>
              <View style={[styles.compareBarFill, { width: `${Math.min(100, (currentTotal / Math.max(currentTotal, prevTotal)) * 100)}%`, backgroundColor: Colors.primary }]} />
            </View>
          </View>
          <View style={styles.compareBarRow}>
            <Text style={styles.compareBarLabel}>{t('last_period')}</Text>
            <View style={styles.compareBarTrack}>
              <View style={[styles.compareBarFill, { width: `${Math.min(100, (prevTotal / Math.max(currentTotal, prevTotal)) * 100)}%`, backgroundColor: Colors.textMuted }]} />
            </View>
          </View>
        </View>
      )}
    </AnimatedCard>
  );
}

export default React.memo(MonthlyCompareCard);
