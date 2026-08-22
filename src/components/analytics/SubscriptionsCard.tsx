// S.P.A.R.K. — Analiz kartı: Abonelikler (aylık yük + yaklaşan ödemeler)
import React from 'react';
import { View, Text } from 'react-native';
import Animated, { FadeInDown } from 'react-native-reanimated';
import { MaterialCommunityIcons } from '@expo/vector-icons';
import AnimatedCard from '../AnimatedCard';
import { Colors } from '../../theme/colors';
import { useThemeRevision } from '../../theme/themeStore';
import { formatCurrency } from '../../utils/formatCurrency';
import type { BaseCardProps, SubscriptionInfo } from './shared';

interface SubscriptionsCardProps extends BaseCardProps {
  subscriptionInfo: SubscriptionInfo;
}

function SubscriptionsCard({ styles, t, currency, subscriptionInfo }: SubscriptionsCardProps) {
  useThemeRevision();
  const { count, monthlyTotal, upcoming } = subscriptionInfo;

  if (count === 0) return null;

  return (
    <AnimatedCard delay={160} style={styles.section}>
      <View style={styles.subsHeader}>
        <View style={styles.subsHeaderLeft}>
          <View style={[styles.subsHeaderIcon, { backgroundColor: Colors.info + '1F' }]}>
            <MaterialCommunityIcons name="sync-circle" size={16} color={Colors.info} />
          </View>
          <Text style={styles.cardHeaderTitle}>{t('subs_card_title')}</Text>
        </View>
        <View style={[styles.subsCountBadge, { backgroundColor: Colors.surfaceLight }]}>
          <Text style={styles.subsCountText}>{count}</Text>
        </View>
      </View>

      {/* Hero: aylık toplam yük */}
      <View style={styles.subsHeroBlock}>
        <Text style={styles.subsHeroLabel}>{t('subs_card_monthly_load')}</Text>
        <Text style={styles.subsHeroValue} numberOfLines={1} adjustsFontSizeToFit minimumFontScale={0.7}>
          {formatCurrency(monthlyTotal, currency)}
        </Text>
      </View>

      {/* Yaklaşanlar */}
      <View style={styles.subsUpcomingHeader}>
        <Text style={styles.subsUpcomingLabel}>{t('subs_card_upcoming')}</Text>
        <View style={styles.subsDividerLine} />
      </View>
      <View style={styles.subsList}>
        {upcoming.map((s, i) => {
          const dayLabel =
            s.daysUntil < 0 ? t('subs_card_overdue') :
            s.daysUntil === 0 ? t('subs_card_today') :
            s.daysUntil === 1 ? t('subs_card_tomorrow') :
            t('subs_card_in_days', { days: s.daysUntil.toString() });
          const dayAccent = s.daysUntil < 0 ? Colors.danger : s.daysUntil <= 3 ? Colors.warning : Colors.textSecondary;
          const catColor = s.category_color || Colors.primary;
          return (
            <Animated.View key={s.id} entering={FadeInDown.delay(i * 60).duration(280)} style={styles.subsRow}>
              <View style={[styles.subsAvatar, { backgroundColor: catColor + '22' }]}>
                <MaterialCommunityIcons
                  name={(s.category_icon as any) || 'tag-outline'}
                  size={18}
                  color={catColor}
                />
              </View>
              <View style={styles.subsRowMain}>
                <Text style={styles.subsRowName} numberOfLines={1}>{s.vendor_name}</Text>
                <View style={styles.subsRowMeta}>
                  <MaterialCommunityIcons name="clock-outline" size={11} color={dayAccent} />
                  <Text style={[styles.subsRowDays, { color: dayAccent }]} numberOfLines={1}>{dayLabel}</Text>
                </View>
              </View>
              <Text style={styles.subsRowAmount}>
                {s.amount == null ? '—' : formatCurrency(s.amount, currency)}
              </Text>
            </Animated.View>
          );
        })}
      </View>
    </AnimatedCard>
  );
}

export default React.memo(SubscriptionsCard);
