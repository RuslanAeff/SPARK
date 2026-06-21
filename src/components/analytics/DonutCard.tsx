// S.P.A.R.K. — Analiz kartı: Davranışsal analiz (needs/wants + week/weekend donut'ları)
import React from 'react';
import { View, Text, ScrollView, Dimensions } from 'react-native';
import { MaterialCommunityIcons } from '@expo/vector-icons';
import AnimatedCard from '../AnimatedCard';
import DonutChart from '../DonutChart';
import { Colors } from '../../theme/colors';
import { ScreenPadding, Spacing } from '../../theme/spacing';
import { formatCurrency } from '../../utils/formatCurrency';
import type { BaseCardProps, BehaviorSegment, DonutSegment } from './shared';

interface DonutCardProps extends BaseCardProps {
  needsWants: BehaviorSegment[];
  weekWeekend: BehaviorSegment[];
  nwSegments: DonutSegment[];
  wwSegments: DonutSegment[];
  selectedNWIdx: number | null;
  selectedWWIdx: number | null;
  handleNWSelect: (idx: number) => void;
  handleWWSelect: (idx: number) => void;
}

function DonutCard({
  styles, t, currency, needsWants, weekWeekend, nwSegments, wwSegments,
  selectedNWIdx, selectedWWIdx, handleNWSelect, handleWWSelect,
}: DonutCardProps) {
  if (needsWants.length === 0 && weekWeekend.length === 0) return null;

  const nwItem = selectedNWIdx !== null ? needsWants[selectedNWIdx] : null;
  const wwItem = selectedWWIdx !== null ? weekWeekend[selectedWWIdx] : null;

  const screenWidth = Dimensions.get('window').width;
  const cardInnerWidth = screenWidth - (ScreenPadding.horizontal * 2);

  return (
    <AnimatedCard delay={300} style={{ ...styles.section, ...styles.primaryCard, paddingHorizontal: 0 }}>
      <Text style={[styles.sectionTitle, { paddingHorizontal: Spacing.lg }]}>{t('behavioral_analysis')}</Text>
      <ScrollView horizontal pagingEnabled showsHorizontalScrollIndicator={false} snapToInterval={cardInnerWidth} decelerationRate="fast">

        {/* Donut 1: Needs vs Wants */}
        <View style={[styles.donutCard, { width: cardInnerWidth }]}>
          <Text style={styles.trendTitle}>{t('budget_philosophy')}</Text>
          <DonutChart
            segments={nwSegments}
            size={220}
            strokeWidth={32}
            selectedIndex={selectedNWIdx}
            onSelect={handleNWSelect}
            innerContent={
              <View style={styles.donutCenter}>
                {nwItem ? (
                  <>
                    <Text style={[styles.donutTotal, { color: nwItem.color }]}>{nwItem.percentage}%</Text>
                    <Text style={styles.donutLabel}>{nwItem.segment}</Text>
                    <Text style={styles.donutSub}>{formatCurrency(nwItem.total, currency, false)}</Text>
                  </>
                ) : (
                  <>
                    <MaterialCommunityIcons name="brain" size={32} color={Colors.primary} />
                    <Text style={styles.donutLabel}>{t('spending_type')}</Text>
                  </>
                )}
              </View>
            }
          />
          <View style={styles.donutAnalysisContainer}>
            {nwItem ? (
              <Text style={styles.donutAnalysisText}>
                {nwItem.segment === t('needs')
                   ? t('needs_analysis', { percentage: nwItem.percentage.toString() })
                   : nwItem.segment === t('wants')
                   ? t('wants_analysis', { percentage: nwItem.percentage.toString() })
                   : t('savings_other_analysis', { percentage: nwItem.percentage.toString() })}
              </Text>
            ) : (
              <Text style={styles.donutAnalysisHint}>{t('donut_hint_swipe_right')}</Text>
            )}
          </View>
        </View>

        {/* Donut 2: Weekday vs Weekend */}
        <View style={[styles.donutCard, { width: cardInnerWidth }]}>
           <Text style={styles.trendTitle}>{t('spending_time')}</Text>
           <DonutChart
            segments={wwSegments}
            size={220}
            strokeWidth={32}
            selectedIndex={selectedWWIdx}
            onSelect={handleWWSelect}
            innerContent={
              <View style={styles.donutCenter}>
                {wwItem ? (
                  <>
                    <Text style={[styles.donutTotal, { color: wwItem.color }]}>{wwItem.percentage}%</Text>
                    <Text style={styles.donutLabel}>{wwItem.segment}</Text>
                    <Text style={styles.donutSub}>{formatCurrency(wwItem.total, currency, false)}</Text>
                  </>
                ) : (
                  <>
                    <MaterialCommunityIcons name="calendar-clock" size={32} color={Colors.primary} />
                    <Text style={styles.donutLabel}>{t('time_segment')}</Text>
                  </>
                )}
              </View>
            }
          />
          <View style={styles.donutAnalysisContainer}>
            {wwItem ? (
              <Text style={styles.donutAnalysisText}>
                {t('time_analysis', { percentage: wwItem.percentage.toString(), segment: wwItem.segment.toLowerCase() })}
              </Text>
            ) : (
              <Text style={styles.donutAnalysisHint}>{t('donut_hint_swipe_left')}</Text>
            )}
          </View>
        </View>

      </ScrollView>
    </AnimatedCard>
  );
}

export default React.memo(DonutCard);
