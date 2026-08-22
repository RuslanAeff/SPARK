// S.P.A.R.K. — Analiz kartı: Harcama serisi (sıfır gün / seri / bütçe altı) + detay sheet
import React, { type Dispatch, type SetStateAction } from 'react';
import { View, Text, Pressable } from 'react-native';
import { MaterialCommunityIcons } from '@expo/vector-icons';
import AnimatedCard from '../AnimatedCard';
import MarqueeText from '../MarqueeText';
import { Colors } from '../../theme/colors';
import { useThemeRevision } from '../../theme/themeStore';
import { CountUpText, type BaseCardProps, type StreakData, type StreakVariant } from './shared';

interface StreakCardProps extends BaseCardProps {
  streakData: StreakData;
  setStreakDetailVariant: Dispatch<SetStateAction<StreakVariant | null>>;
}

function StreakCard({ styles, t, streakData, setStreakDetailVariant }: StreakCardProps) {
  useThemeRevision();
  const {
    status,
    streakMode,
    dailyTarget,
    zeroSpendDays,
    currentStreak,
    underBudgetDays,
    totalDays,
    recordedDays,
    coveragePct,
  } = streakData;
  const canShowStats = status === 'ready';
  const behaviorRatio = dailyTarget !== null
    ? (recordedDays > 0 ? underBudgetDays / recordedDays : 0)
    : coveragePct / 100;
  const streakType = behaviorRatio >= 0.5 ? 'great' : behaviorRatio >= 0.25 ? 'good' : 'start';
  const streakMsg = status === 'no_data'
    ? t('streak_no_data')
    : status === 'no_completed_days'
      ? t('streak_no_completed_days')
      : status === 'insufficient_history'
        ? t('streak_insufficient_history')
        : recordedDays === 0
          ? t('streak_no_recorded_days')
          : dailyTarget === null
            ? streakType === 'great'
              ? t('streak_tracking_great')
              : streakType === 'good'
                ? t('streak_tracking_good')
                : t('streak_tracking_start')
            : streakType === 'great'
              ? t('streak_great')
              : streakType === 'good'
                ? t('streak_good')
                : t('streak_start');
  const StreakIcon = streakType === 'great' ? 'fire' : streakType === 'good' ? 'thumb-up' : 'target';
  const streakLabel = streakMode === 'current' ? t('current_streak') : t('period_end_streak');

  return (
    <AnimatedCard delay={250} style={styles.section}>
      <Text style={styles.sectionTitle}>{t('spending_streak')}</Text>
      <View style={styles.streakGrid}>
        <Pressable
          style={({ pressed }) => [styles.streakCard, pressed && styles.streakCardPressed]}
          onPress={() => setStreakDetailVariant('zero')}
          disabled={!canShowStats}
          accessibilityRole="button"
          accessibilityLabel={t('zero_spend_days')}
        >
          <View style={[styles.streakIconBg, { backgroundColor: Colors.success + '18' }]}>
            <MaterialCommunityIcons name="calendar-check" size={22} color={Colors.success} />
          </View>
          {canShowStats
            ? <CountUpText value={zeroSpendDays} style={styles.streakNumber} duration={900} />
            : <Text style={styles.streakNumber}>—</Text>}
          <Text style={styles.streakLabel}>{t('zero_spend_days')}</Text>
        </Pressable>
        <Pressable
          style={({ pressed }) => [styles.streakCard, pressed && styles.streakCardPressed]}
          onPress={() => setStreakDetailVariant('streak')}
          disabled={!canShowStats}
          accessibilityRole="button"
          accessibilityLabel={streakLabel}
        >
          <View style={[styles.streakIconBg, { backgroundColor: Colors.warning + '18' }]}>
            <MaterialCommunityIcons name="fire" size={22} color={Colors.warning} />
          </View>
          {canShowStats
            ? <CountUpText value={currentStreak} style={styles.streakNumber} duration={900} />
            : <Text style={styles.streakNumber}>—</Text>}
          <Text style={styles.streakLabel}>{streakLabel}</Text>
        </Pressable>
        {dailyTarget !== null && (
          <Pressable
            style={({ pressed }) => [styles.streakCard, pressed && styles.streakCardPressed]}
            onPress={() => setStreakDetailVariant('under')}
            disabled={!canShowStats}
            accessibilityRole="button"
            accessibilityLabel={t('under_budget_days')}
          >
            <View style={[styles.streakIconBg, { backgroundColor: Colors.primary + '18' }]}>
              <MaterialCommunityIcons name="shield-check" size={22} color={Colors.primary} />
            </View>
            {canShowStats
              ? <CountUpText value={underBudgetDays} style={styles.streakNumber} duration={900} />
              : <Text style={styles.streakNumber}>—</Text>}
            <Text style={styles.streakLabel}>{t('under_budget_days')}</Text>
          </Pressable>
        )}
      </View>
      <View style={styles.streakMsg}>
        <View style={[styles.streakMsgIconWrap, { backgroundColor: (streakType === 'great' ? Colors.warning : streakType === 'good' ? Colors.primary : Colors.info) + '22' }]}>
          <MaterialCommunityIcons
            name={StreakIcon as any}
            size={20}
            color={streakType === 'great' ? Colors.warning : streakType === 'good' ? Colors.primary : Colors.info}
          />
        </View>
        <View style={styles.streakMsgBody}>
          <MarqueeText text={streakMsg} style={styles.streakMsgTextInner} containerStyle={styles.streakMsgText} />
          {totalDays > 0 && (
            <Text style={styles.streakMsgSub}>
              {t('streak_coverage_summary', { recorded: recordedDays, total: totalDays })}
            </Text>
          )}
        </View>
      </View>
    </AnimatedCard>
  );
}

export default React.memo(StreakCard);
