// S.P.A.R.K. — Analiz kartı: Sessiz harcamalar (küçük ama tekrarlayan kalemler)
import React from 'react';
import { View, Text, Pressable } from 'react-native';
import Animated, { FadeInDown } from 'react-native-reanimated';
import { MaterialCommunityIcons } from '@expo/vector-icons';
import AnimatedCard from '../AnimatedCard';
import { Colors } from '../../theme/colors';
import { formatCurrency } from '../../utils/formatCurrency';
import { itemDisplayName } from '../../utils/itemDisplayName';
import type { BaseCardProps, SilentSpendInfo } from './shared';

interface SilentSpendCardProps extends BaseCardProps {
  silentSpendInfo: SilentSpendInfo;
  onSelectItem: (name: string) => void;
}

function SilentSpendCard({ styles, t, currency, silentSpendInfo, onSelectItem }: SilentSpendCardProps) {
  if (!silentSpendInfo.available) {
    return (
      <AnimatedCard delay={220} style={styles.section}>
        <View style={styles.silentHeader}>
          <View style={styles.silentHeaderLeft}>
            <MaterialCommunityIcons name="water-outline" size={18} color={Colors.textSecondary} />
            <Text style={styles.sectionTitle}>{t('silent_card_title')}</Text>
          </View>
        </View>
        <View style={styles.silentEmptyWrap}>
          <MaterialCommunityIcons name="water-off-outline" size={36} color={Colors.textMuted} />
          <Text style={styles.silentEmptyTitle}>{t('silent_card_empty_title')}</Text>
          <Text style={styles.silentEmptyHint}>{t('silent_card_empty_hint')}</Text>
        </View>
      </AnimatedCard>
    );
  }

  const { items, totalAmount, totalCount, distinctItems } = silentSpendInfo;
  return (
    <AnimatedCard delay={220} style={styles.section}>
      <View style={styles.silentHeader}>
        <View style={styles.silentHeaderLeft}>
          <View style={[styles.silentHeaderIcon, { backgroundColor: Colors.warning + '1F' }]}>
            <MaterialCommunityIcons name="water-outline" size={16} color={Colors.warning} />
          </View>
          <Text style={styles.sectionTitle}>{t('silent_card_title')}</Text>
        </View>
      </View>

      {/* Hero block */}
      <View style={styles.silentHeroBlock}>
        <Text style={styles.silentHeroLabel}>{t('silent_card_total_label')}</Text>
        <Text style={styles.silentHeroValue} numberOfLines={1} adjustsFontSizeToFit minimumFontScale={0.7}>
          {formatCurrency(totalAmount, currency)}
        </Text>
        <View style={styles.silentHeroMeta}>
          <Text style={styles.silentHeroMetaText}>{t('silent_card_count_label', { count: totalCount.toString() })}</Text>
          <View style={styles.silentHeroMetaDot} />
          <Text style={styles.silentHeroMetaText}>{t('silent_card_distinct', { count: distinctItems.toString() })}</Text>
        </View>
      </View>

      <Text style={styles.silentHint}>{t('silent_card_hint')}</Text>

      {/* Item list */}
      <View style={styles.silentList}>
        {items.map((it, i) => {
          const displayName = itemDisplayName(it).primary;
          const catColor = it.category_color || Colors.warning;
          const icon = (it.category_icon as any) || 'water-outline';
          return (
            <Animated.View key={it.normalized_key} entering={FadeInDown.delay(i * 50).duration(280)}>
              <Pressable
                onPress={() => onSelectItem(it.name)}
                style={({ pressed }) => [styles.silentRow, pressed && { opacity: 0.85 }]}
                accessibilityRole="button"
              >
                <View style={[styles.silentAvatar, { backgroundColor: catColor + '22' }]}>
                  <MaterialCommunityIcons name={icon} size={16} color={catColor} />
                </View>
                <View style={styles.silentRowMain}>
                  <Text style={styles.silentRowName} numberOfLines={1}>{displayName}</Text>
                  <View style={styles.silentRowMeta}>
                    <Text style={styles.silentRowTimes}>{t('silent_card_times', { count: it.purchase_count.toString() })}</Text>
                    <View style={styles.silentRowMetaDot} />
                    <Text style={styles.silentRowAvg}>{t('silent_card_avg', { amount: formatCurrency(it.avg_price, currency, false) })}</Text>
                  </View>
                </View>
                <Text style={styles.silentRowTotal}>{formatCurrency(it.total_spent, currency, false)}</Text>
              </Pressable>
            </Animated.View>
          );
        })}
      </View>
    </AnimatedCard>
  );
}

export default React.memo(SilentSpendCard);
