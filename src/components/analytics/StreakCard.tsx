// S.P.A.R.K. — Analiz kartı: Harcama serisi (sıfır gün / seri / bütçe altı) + detay sheet
import React, { type Dispatch, type SetStateAction } from 'react';
import { View, Text, Pressable } from 'react-native';
import { MaterialCommunityIcons } from '@expo/vector-icons';
import AnimatedCard from '../AnimatedCard';
import { Colors } from '../../theme/colors';
import { CountUpText, type BaseCardProps, type StreakData, type StreakVariant } from './shared';

interface StreakCardProps extends BaseCardProps {
  streakData: StreakData;
  dailyBudget: number;
  setStreakDetailVariant: Dispatch<SetStateAction<StreakVariant | null>>;
}

function StreakCard({ styles, t, streakData, dailyBudget, setStreakDetailVariant }: StreakCardProps) {
  const { zeroSpendDays, currentStreak, underBudgetDays, totalDays } = streakData;
  const streakType = currentStreak >= 3 ? 'great' : currentStreak >= 1 ? 'good' : 'start';
  const streakMsg = streakType === 'great' ? t('streak_great') : streakType === 'good' ? t('streak_good') : t('streak_start');
  const StreakIcon = streakType === 'great' ? 'fire' : streakType === 'good' ? 'thumb-up' : 'target';

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
          accessibilityLabel={t('current_streak')}
        >
          <View style={[styles.streakIconBg, { backgroundColor: Colors.warning + '18' }]}>
            <MaterialCommunityIcons name="fire" size={22} color={Colors.warning} />
          </View>
          <CountUpText value={currentStreak} style={styles.streakNumber} duration={900} />
          <Text style={styles.streakLabel}>{t('current_streak')}</Text>
        </Pressable>
        {dailyBudget > 0 && (
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
        <View style={styles.streakMsgRow}>
          <View style={[styles.streakMsgIconWrap, { backgroundColor: (streakType === 'great' ? Colors.warning : streakType === 'good' ? Colors.primary : Colors.info) + '22' }]}>
            <MaterialCommunityIcons
              name={StreakIcon as any}
              size={20}
              color={streakType === 'great' ? Colors.warning : streakType === 'good' ? Colors.primary : Colors.info}
            />
          </View>
          <Text style={styles.streakMsgText} numberOfLines={1} ellipsizeMode="tail">{streakMsg}</Text>
        </View>
        {totalDays > 0 && (
          <View style={styles.streakMsgSubWrap}>
            <Text style={styles.streakMsgSub}>
              {zeroSpendDays}/{totalDays} {t('days_label')}
            </Text>
          </View>
        )}
      </View>
    </AnimatedCard>
  );
}

export default React.memo(StreakCard);
