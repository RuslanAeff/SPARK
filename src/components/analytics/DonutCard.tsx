// S.P.A.R.K. — Analiz kartı: Davranışsal analiz (needs/wants + week/weekend donut'ları)
import React, { useState } from 'react';
import { View, Text, ScrollView, Dimensions, Pressable } from 'react-native';
import { MaterialCommunityIcons } from '@expo/vector-icons';
import AnimatedCard from '../AnimatedCard';
import DonutChart from '../DonutChart';
import { Colors } from '../../theme/colors';
import { useThemeRevision } from '../../theme/themeStore';
import { ScreenPadding, Spacing } from '../../theme/spacing';
import { formatCurrency } from '../../utils/formatCurrency';
import type { BaseCardProps, BehaviorSegment, DonutSegment } from './shared';
import { SettingsInfoHintModal, SettingsInfoIconButton } from '../SettingsInfoHint';

interface DonutCardProps extends BaseCardProps {
  needsWants: BehaviorSegment[];
  weekWeekend: BehaviorSegment[];
  nwSegments: DonutSegment[];
  wwSegments: DonutSegment[];
  selectedNWIdx: number | null;
  selectedWWIdx: number | null;
  handleNWSelect: (idx: number) => void;
  handleWWSelect: (idx: number) => void;
  handleNWMove: (direction: -1 | 1) => void;
  handleWWMove: (direction: -1 | 1) => void;
}

function DonutCard({
  styles, t, currency, needsWants, weekWeekend, nwSegments, wwSegments,
  selectedNWIdx, selectedWWIdx, handleNWSelect, handleWWSelect,
  handleNWMove, handleWWMove,
}: DonutCardProps) {
  useThemeRevision();
  if (needsWants.length === 0 && weekWeekend.length === 0) return null;

  const nwItem = selectedNWIdx !== null ? needsWants[selectedNWIdx] : null;
  const wwItem = selectedWWIdx !== null ? weekWeekend[selectedWWIdx] : null;

  // Sayfa genişliğini HESAPLAMA yerine ÖLÇ: parent padding + kart border/padding
  // birleşimi hesapla tutmadığında her donut sayfası viewport'tan dar kalıp sonraki
  // donut'un sağdan sızmasına yol açıyordu. onLayout ile ScrollView'in gerçek
  // görünüm genişliğini alıp her sayfayı tam ona eşitliyoruz → kusursuz paging.
  const screenWidth = Dimensions.get('window').width;
  const [pageW, setPageW] = useState(screenWidth - ScreenPadding.horizontal * 2); // ilk render fallback
  const [infoVisible, setInfoVisible] = useState(false);

  return (
    <AnimatedCard delay={300} style={{ ...styles.section, ...styles.primaryCard, paddingHorizontal: 0 }}>
      <View style={{ flexDirection: 'row', alignItems: 'center', paddingHorizontal: Spacing.lg }}>
        <Text style={[styles.sectionTitle, { flex: 1 }]}>{t('behavioral_analysis')}</Text>
        <SettingsInfoIconButton
          onPress={() => setInfoVisible(true)}
          accessibilityLabel={t('behavioral_analysis_info_a11y')}
        />
      </View>
      <ScrollView
        horizontal
        pagingEnabled
        showsHorizontalScrollIndicator={false}
        decelerationRate="fast"
        onLayout={(e) => {
          const w = e.nativeEvent.layout.width;
          if (w > 0 && Math.abs(w - pageW) > 0.5) setPageW(w);
        }}
      >

        {/* Donut 1: Needs vs Wants */}
        <View style={[styles.donutCard, { width: pageW }]}>
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
              <View style={styles.donutAnalysisNavRow}>
                <Pressable
                  testID="donut-nw-previous"
                  onPress={() => handleNWMove(-1)}
                  style={({ pressed }) => [styles.donutNavButton, pressed && styles.donutNavButtonPressed]}
                  accessibilityRole="button"
                  accessibilityLabel={t('donut_previous_segment')}
                >
                  <MaterialCommunityIcons name="chevron-left" size={20} color={Colors.textSecondary} />
                </Pressable>
                <Text style={[styles.donutAnalysisText, styles.donutAnalysisTextFlex]}>
                  {nwItem.segment === t('needs')
                     ? t('needs_analysis', { percentage: nwItem.percentage.toString() })
                     : nwItem.segment === t('wants')
                     ? t('wants_analysis', { percentage: nwItem.percentage.toString() })
                     : t('savings_other_analysis', { percentage: nwItem.percentage.toString() })}
                </Text>
                <Pressable
                  testID="donut-nw-next"
                  onPress={() => handleNWMove(1)}
                  style={({ pressed }) => [styles.donutNavButton, pressed && styles.donutNavButtonPressed]}
                  accessibilityRole="button"
                  accessibilityLabel={t('donut_next_segment')}
                >
                  <MaterialCommunityIcons name="chevron-right" size={20} color={Colors.textSecondary} />
                </Pressable>
              </View>
            ) : (
              <View style={styles.donutAnalysisHintRow}>
                <Text style={styles.donutAnalysisHint}>{t('donut_hint_swipe_right')}</Text>
                <MaterialCommunityIcons name="arrow-right" size={15} color={Colors.textMuted} />
              </View>
            )}
          </View>
        </View>

        {/* Donut 2: Weekday vs Weekend */}
        <View style={[styles.donutCard, { width: pageW }]}>
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
              <View style={styles.donutAnalysisNavRow}>
                <Pressable
                  testID="donut-ww-previous"
                  onPress={() => handleWWMove(-1)}
                  style={({ pressed }) => [styles.donutNavButton, pressed && styles.donutNavButtonPressed]}
                  accessibilityRole="button"
                  accessibilityLabel={t('donut_previous_segment')}
                >
                  <MaterialCommunityIcons name="chevron-left" size={20} color={Colors.textSecondary} />
                </Pressable>
                <Text style={[styles.donutAnalysisText, styles.donutAnalysisTextFlex]}>
                  {t('time_analysis', { percentage: wwItem.percentage.toString(), segment: wwItem.segment.toLowerCase() })}
                </Text>
                <Pressable
                  testID="donut-ww-next"
                  onPress={() => handleWWMove(1)}
                  style={({ pressed }) => [styles.donutNavButton, pressed && styles.donutNavButtonPressed]}
                  accessibilityRole="button"
                  accessibilityLabel={t('donut_next_segment')}
                >
                  <MaterialCommunityIcons name="chevron-right" size={20} color={Colors.textSecondary} />
                </Pressable>
              </View>
            ) : (
              <View style={styles.donutAnalysisHintRow}>
                <MaterialCommunityIcons name="arrow-left" size={15} color={Colors.textMuted} />
                <Text style={styles.donutAnalysisHint}>{t('donut_hint_swipe_left')}</Text>
              </View>
            )}
          </View>
        </View>

      </ScrollView>
      <SettingsInfoHintModal
        visible={infoVisible}
        onClose={() => setInfoVisible(false)}
        title={t('behavioral_analysis_info_title')}
        paragraphs={[
          t('behavioral_analysis_info_needs'),
          t('behavioral_analysis_info_wants'),
          t('behavioral_analysis_info_other'),
          t('behavioral_analysis_info_note'),
        ]}
      />
    </AnimatedCard>
  );
}

export default React.memo(DonutCard);
