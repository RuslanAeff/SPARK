// S.P.A.R.K. — Analiz kartı: Harcama serisi (sıfır gün / seri / bütçe altı) + detay sheet
import React, { type Dispatch, type SetStateAction } from 'react';
import { View, Text, Pressable } from 'react-native';
import { MaterialCommunityIcons } from '@expo/vector-icons';
import AnimatedCard from '../AnimatedCard';
import MarqueeText from '../MarqueeText';
import { Colors } from '../../theme/colors';
import { CountUpText, type BaseCardProps, type StreakData, type StreakVariant } from './shared';

interface StreakCardProps extends BaseCardProps {
  streakData: StreakData;
  setStreakDetailVariant: Dispatch<SetStateAction<StreakVariant | null>>;
}

function StreakCard({ styles, t, streakData, setStreakDetailVariant }: StreakCardProps) {
  const {
    status,
    streakMode,
    dailyTarget,
    zeroSpendDays,
    currentStreak,
    underBudgetDays,
    totalDays,
  } = streakData;
  const streakType = currentStreak >= 3 ? 'great' : currentStreak >= 1 ? 'good' : 'start';
  const streakMsg = status === 'no_data'
    ? t('streak_no_data')
    : status === 'no_completed_days'
      ? t('streak_no_completed_days')
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
          accessibilityRole="button"
          accessibilityLabel={t('zero_spend_days')}
        >
          <View style={[styles.streakIconBg, { backgroundColor: Colors.success + '18' }]}>
            <MaterialCommunityIcons name="calendar-check" size={22} color={Colors.success} />
          </View>
          <CountUpText value={zeroSpendDays} style={styles.streakNumber} duration={900} />
          <Text style={styles.streakLabel}>{t('zero_spend_days')}</Text>
        </Pressable>
        <Pressable
          style={({ pressed }) => [styles.streakCard, pressed && styles.streakCardPressed]}
          onPress={() => setStreakDetailVariant('streak')}
          accessibilityRole="button"
          accessibilityLabel={streakLabel}
        >
          <View style={[styles.streakIconBg, { backgroundColor: Colors.warning + '18' }]}>
            <MaterialCommunityIcons name="fire" size={22} color={Colors.warning} />
          </View>
          <CountUpText value={currentStreak} style={styles.streakNumber} duration={900} />
          <Text style={styles.streakLabel}>{streakLabel}</Text>
        </Pressable>
        {dailyTarget !== null && (
          <Pressable
            style={({ pressed }) => [styles.streakCard, pressed && styles.streakCardPressed]}
            onPress={() => setStreakDetailVariant('under')}
            accessibilityRole="button"
            accessibilityLabel={t('under_budget_days')}
          >
            <View style={[styles.streakIconBg, { backgroundColor: Colors.primary + '18' }]}>
              <MaterialCommunityIcons name="shield-check" size={22} color={Colors.primary} />
            </View>
            <CountUpText value={underBudgetDays} style={styles.streakNumber} duration={900} />
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
              {t('streak_scope_summary', { zero: zeroSpendDays, total: totalDays })}
            </Text>
          )}
        </View>
      </View>
    </AnimatedCard>
  );
}

export default React.memo(StreakCard);
