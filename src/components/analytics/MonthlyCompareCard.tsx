// S.P.A.R.K. — Analiz kartı: Dönem karşılaştırması (bu dönem vs önceki dönem)
import React from 'react';
import { View, Text } from 'react-native';
import { MaterialCommunityIcons } from '@expo/vector-icons';
import AnimatedCard from '../AnimatedCard';
import { Colors } from '../../theme/colors';
import { useThemeRevision } from '../../theme/themeStore';
import { formatCurrency } from '../../utils/formatCurrency';
import type { BaseCardProps, Timeframe } from './shared';

interface MonthlyCompareCardProps extends BaseCardProps {
  timeframe: Timeframe;
  currentTotal: number;
  prevTotal: number;
  comparisonDelta: number | null;
}

function MonthlyCompareCard({
  styles, t, currency, timeframe, currentTotal, prevTotal, comparisonDelta,
}: MonthlyCompareCardProps) {
  useThemeRevision();
  if (timeframe === 'year') return null;
  return (
    <AnimatedCard delay={150} style={styles.section}>
      <Text style={styles.sectionTitle}>{t('monthly_comparison')}</Text>
      <View style={styles.compareRow}>
        <View style={styles.compareBlock}>
          <Text style={styles.compareLabel}>{t('this_period')}</Text>
          <Text style={styles.compareValue}>{formatCurrency(currentTotal, currency)}</Text>
        </View>
        <View style={styles.compareDivider} />
        <View style={styles.compareBlock}>
          <Text style={styles.compareLabel}>{t('last_period')}</Text>
          <Text style={[styles.compareValue, { color: Colors.textSecondary }]}>
            {prevTotal > 0 ? formatCurrency(prevTotal, currency) : '—'}
          </Text>
        </View>
      </View>
      {comparisonDelta !== null ? (
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
      ) : (
        <View style={styles.deltaBadge}>
          <MaterialCommunityIcons name="information-outline" size={16} color={Colors.textMuted} />
          <Text style={[styles.deltaText, { color: Colors.textMuted }]}>{t('no_previous_data')}</Text>
        </View>
      )}
      {/* Mini comparison bars */}
      {prevTotal > 0 && (
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
