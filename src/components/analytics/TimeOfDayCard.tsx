// S.P.A.R.K. — Analiz kartı: Gün/zaman dilimi harcama ısı haritası (7×4 grid)
import React from 'react';
import { View, Text } from 'react-native';
import { MaterialCommunityIcons } from '@expo/vector-icons';
import AnimatedCard from '../AnimatedCard';
import { Colors } from '../../theme/colors';
import type { BaseCardProps, TimeOfDayInfo } from './shared';

interface TimeOfDayCardProps extends BaseCardProps {
  timeOfDayInfo: TimeOfDayInfo;
}

function TimeOfDayCard({ styles, t, timeOfDayInfo }: TimeOfDayCardProps) {
  if (!timeOfDayInfo.available) {
    return (
      <AnimatedCard delay={170} style={styles.section}>
        <View style={styles.todHeader}>
          <View style={styles.todHeaderLeft}>
            <MaterialCommunityIcons name="clock-time-eight-outline" size={18} color={Colors.textSecondary} />
            <Text style={styles.sectionTitle}>{t('timeofday_title')}</Text>
          </View>
        </View>
        <View style={styles.todEmptyWrap}>
          <MaterialCommunityIcons name="clock-outline" size={36} color={Colors.textMuted} />
          <Text style={styles.todEmptyTitle}>{t('timeofday_empty_title')}</Text>
          <Text style={styles.todEmptyHint}>{t('timeofday_empty_hint')}</Text>
        </View>
      </AnimatedCard>
    );
  }

  const { matrix, peakDow, peakSlot, peakValue } = timeOfDayInfo;
  // Pazartesi başlat: schema'da 0=Pazar; biz UI'da Pazartesi'den başlatıyoruz.
  const dowOrder = [1, 2, 3, 4, 5, 6, 0]; // Mon..Sun
  const dowLabelKeys = ['weekday_mon', 'weekday_tue', 'weekday_wed', 'weekday_thu', 'weekday_fri', 'weekday_sat', 'weekday_sun'];
  const slotKeys = ['timeofday_morning_short', 'timeofday_noon_short', 'timeofday_evening_short', 'timeofday_night_short'];
  const slotFullKeys = ['timeofday_morning', 'timeofday_noon', 'timeofday_evening', 'timeofday_night'];
  const peakDayLabel = t(dowLabelKeys[dowOrder.indexOf(peakDow)]);
  const peakSlotLabel = t(slotFullKeys[peakSlot]);

  return (
    <AnimatedCard delay={170} style={styles.section}>
      <View style={styles.todHeader}>
        <View style={styles.todHeaderLeft}>
          <View style={[styles.todHeaderIcon, { backgroundColor: Colors.primary + '1F' }]}>
            <MaterialCommunityIcons name="clock-time-eight-outline" size={16} color={Colors.primary} />
          </View>
          <Text style={styles.sectionTitle}>{t('timeofday_title')}</Text>
        </View>
        {peakValue > 0 && (
          <View style={[styles.todPeakChip, { backgroundColor: Colors.primary + '14' }]}>
            <MaterialCommunityIcons name="fire" size={11} color={Colors.primary} />
            <Text style={styles.todPeakChipText}>{t('timeofday_peak_value', { day: peakDayLabel, slot: peakSlotLabel.toLowerCase() })}</Text>
          </View>
        )}
      </View>

      {/* Grid: ilk satır slot başlıkları, sonra her satır = bir gün */}
      <View style={styles.todGridWrap}>
        {/* Üst etiket satırı (slot'lar) */}
        <View style={styles.todGridHeader}>
          <View style={styles.todDayLabelCell} />
          {slotKeys.map((sk, i) => (
            <View key={i} style={styles.todSlotHeaderCell}>
              <Text style={styles.todSlotHeaderText}>{t(sk)}</Text>
            </View>
          ))}
        </View>

        {/* Her gün için bir satır */}
        {dowOrder.map((dow, rowIdx) => (
          <View key={dow} style={styles.todGridRow}>
            <View style={styles.todDayLabelCell}>
              <Text style={styles.todDayLabelText}>{t(dowLabelKeys[rowIdx])}</Text>
            </View>
            {[0, 1, 2, 3].map((slot) => {
              const value = matrix[dow][slot];
              // Opaklık: ilgili hücrenin peak'a göre oranı (min 0.06 zemin)
              const intensity = peakValue > 0 ? value / peakValue : 0;
              const isPeak = dow === peakDow && slot === peakSlot && value > 0;
              const opacity = value === 0 ? 0 : Math.max(0.18, intensity);
              // Hex alfa: 0..255 → 2 hane. Peak'i her zaman tam opak ve border'lı çizeriz.
              const alphaHex = Math.round(opacity * 255).toString(16).padStart(2, '0');
              const bg = value === 0 ? Colors.surfaceLight : Colors.primary + alphaHex;
              return (
                <View
                  key={slot}
                  style={[
                    styles.todCell,
                    { backgroundColor: bg },
                    isPeak && styles.todCellPeak,
                  ]}
                />
              );
            })}
          </View>
        ))}
      </View>

      <Text style={styles.todDisclaimer}>{t('timeofday_disclaimer')}</Text>
    </AnimatedCard>
  );
}

export default React.memo(TimeOfDayCard);
