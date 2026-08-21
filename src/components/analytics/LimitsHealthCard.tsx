// S.P.A.R.K. — Analiz kartı: Kategori limit sağlığı (limit/harcama oranı barları)
import React from 'react';
import { View, Text, Pressable } from 'react-native';
import Animated, { FadeInDown } from 'react-native-reanimated';
import { MaterialCommunityIcons } from '@expo/vector-icons';
import AnimatedCard from '../AnimatedCard';
import { Colors } from '../../theme/colors';
import { useThemeRevision } from '../../theme/themeStore';
import { formatCurrency } from '../../utils/formatCurrency';
import type { BaseCardProps, LimitsHealthInfo } from './shared';

interface LimitsHealthCardProps extends BaseCardProps {
  limitsHealthInfo: LimitsHealthInfo;
  onManageLimits?: () => void;
}

function LimitsHealthCard({ styles, t, tc, currency, limitsHealthInfo, onManageLimits }: LimitsHealthCardProps) {
  useThemeRevision();
  const { count, overCount, warnCount, items } = limitsHealthInfo;

  if (count === 0) {
    return (
      <AnimatedCard delay={200} style={styles.section}>
        <View style={styles.limitsHeader}>
          <View style={styles.limitsHeaderLeft}>
            <MaterialCommunityIcons name="gauge" size={18} color={Colors.textSecondary} />
            <Text style={styles.cardHeaderTitle}>{t('limits_health_title')}</Text>
          </View>
        </View>
        <Text style={styles.limitsScopeHint}>{t('goal_settings_month_hint')}</Text>
        <View style={styles.limitsEmptyWrap}>
          <MaterialCommunityIcons name="gauge-empty" size={36} color={Colors.textMuted} />
          <Text style={styles.limitsEmptyTitle}>{t('limits_health_empty_title')}</Text>
          <Text style={styles.limitsEmptyHint}>{t('limits_health_empty_hint')}</Text>
          {onManageLimits && (
            <Pressable
              accessibilityRole="button"
              onPress={onManageLimits}
              style={({ pressed }) => [styles.expandButton, pressed && { opacity: 0.8 }]}
            >
              <MaterialCommunityIcons name="plus-circle-outline" size={18} color={Colors.primary} />
              <Text style={styles.expandButtonText}>{t('goal_settings_add_limit')}</Text>
            </Pressable>
          )}
        </View>
      </AnimatedCard>
    );
  }

  return (
    <AnimatedCard delay={200} style={styles.section}>
      <View style={styles.limitsHeader}>
        <View style={styles.limitsHeaderLeft}>
          <View style={[styles.limitsHeaderIcon, { backgroundColor: Colors.primary + '1F' }]}>
            <MaterialCommunityIcons name="gauge" size={16} color={Colors.primary} />
          </View>
          <Text style={styles.cardHeaderTitle}>{t('limits_health_title')}</Text>
        </View>
        <View style={styles.limitsHeaderStats}>
          {overCount > 0 && (
            <View style={[styles.limitsStatChip, { backgroundColor: Colors.danger + '1F' }]}>
              <Text style={[styles.limitsStatChipText, { color: Colors.danger }]}>{overCount}</Text>
              <MaterialCommunityIcons name="alert-circle" size={11} color={Colors.danger} />
            </View>
          )}
          {warnCount > 0 && (
            <View style={[styles.limitsStatChip, { backgroundColor: Colors.warning + '1F' }]}>
              <Text style={[styles.limitsStatChipText, { color: Colors.warning }]}>{warnCount}</Text>
              <MaterialCommunityIcons name="alert" size={11} color={Colors.warning} />
            </View>
          )}
        </View>
      </View>
      <Text style={styles.limitsScopeHint}>{t('goal_settings_month_hint')}</Text>

      <View style={styles.limitsList}>
        {items.map((l, i) => {
          const ratio = l.limit > 0 ? l.spent / l.limit : 0;
          const pctNum = Math.round(ratio * 100);
          const accent =
            ratio >= 1 ? Colors.danger :
            ratio >= 0.7 ? Colors.warning :
            Colors.success;
          const fillPct = Math.min(100, ratio * 100);
          const remaining = l.limit - l.spent;
          const overBy = l.spent - l.limit;
          return (
            <Animated.View key={l.category_id} entering={FadeInDown.delay(i * 50).duration(280)} style={styles.limitRow}>
              <View style={styles.limitRowTop}>
                <View style={[styles.limitIcon, { backgroundColor: l.category_color + '22' }]}>
                  <MaterialCommunityIcons
                    name={(l.category_icon as any) || 'tag-outline'}
                    size={16}
                    color={l.category_color}
                  />
                </View>
                <Text style={styles.limitName} numberOfLines={1}>{tc(l.category_name)}</Text>
                <Text style={[styles.limitPct, { color: accent }]}>{pctNum}%</Text>
              </View>
              <View style={styles.limitTrack}>
                <View style={[styles.limitTrackFill, { width: `${fillPct}%`, backgroundColor: accent }]} />
              </View>
              <View style={styles.limitRowBottom}>
                <Text style={styles.limitAmounts}>
                  <Text style={styles.limitSpent}>{formatCurrency(l.spent, currency, false)}</Text>
                  <Text style={styles.limitDiv}> / </Text>
                  <Text style={styles.limitMax}>{formatCurrency(l.limit, currency, false)}</Text>
                </Text>
                {ratio >= 1 ? (
                  <Text style={[styles.limitRemaining, { color: Colors.danger }]}>
                    +{formatCurrency(overBy, currency, false)} {t('limits_health_over_by')}
                  </Text>
                ) : (
                  <Text style={styles.limitRemaining}>
                    {formatCurrency(remaining, currency, false)} {t('limits_health_remaining')}
                  </Text>
                )}
              </View>
            </Animated.View>
          );
        })}
      </View>
    </AnimatedCard>
  );
}

export default React.memo(LimitsHealthCard);
