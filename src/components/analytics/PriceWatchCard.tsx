// S.P.A.R.K. — Analiz kartı: Fiyat takibi (price watch) — ürün bazlı zam/indirim
import React from 'react';
import { View, Text, Pressable } from 'react-native';
import Animated, { FadeInDown } from 'react-native-reanimated';
import { MaterialCommunityIcons } from '@expo/vector-icons';
import AnimatedCard from '../AnimatedCard';
import { Colors } from '../../theme/colors';
import { formatCurrency } from '../../utils/formatCurrency';
import type { BaseCardProps, PriceChange } from './shared';

interface PriceWatchCardProps extends BaseCardProps {
  priceChanges: PriceChange[];
  onSelectItem: (name: string) => void;
}

function PriceWatchCard({ styles, t, currency, priceChanges, onSelectItem }: PriceWatchCardProps) {
  if (priceChanges.length === 0) return null;
  const upCount = priceChanges.filter(p => p.changePct > 0).length;
  const downCount = priceChanges.length - upCount;
  return (
    <AnimatedCard delay={380} style={styles.section}>
      <View style={styles.priceHeader}>
        <View style={styles.priceHeaderLeft}>
          <MaterialCommunityIcons name="tag-multiple-outline" size={18} color={Colors.warning} />
          <Text style={styles.sectionTitle}>{t('price_watch')}</Text>
        </View>
        <View style={styles.priceHeaderStats}>
          {upCount > 0 && (
            <View style={styles.priceStatChip}>
              <MaterialCommunityIcons name="arrow-up" size={12} color={Colors.danger} />
              <Text style={[styles.priceStatChipText, { color: Colors.danger }]}>{upCount}</Text>
            </View>
          )}
          {downCount > 0 && (
            <View style={styles.priceStatChip}>
              <MaterialCommunityIcons name="arrow-down" size={12} color={Colors.success} />
              <Text style={[styles.priceStatChipText, { color: Colors.success }]}>{downCount}</Text>
            </View>
          )}
        </View>
      </View>
      <View style={styles.priceGrid}>
        {priceChanges.map((pc, i) => {
          const isUp = pc.changePct > 0;
          const displayName = pc.turkishName || pc.name;
          return (
            <Animated.View
              key={i}
              entering={FadeInDown.delay(i * 40).duration(260)}
              style={styles.priceTile}
            >
              <Pressable
                onPress={() => onSelectItem(pc.name)}
                style={({ pressed }) => [styles.priceTileInner, pressed && { opacity: 0.88 }]}
              >
                <View
                  style={[
                    styles.priceTileBadge,
                    { backgroundColor: isUp ? Colors.danger + '18' : Colors.success + '18' },
                  ]}
                >
                  <MaterialCommunityIcons
                    name={isUp ? 'arrow-up' : 'arrow-down'}
                    size={12}
                    color={isUp ? Colors.danger : Colors.success}
                  />
                  <Text
                    style={[
                      styles.priceTilePct,
                      { color: isUp ? Colors.danger : Colors.success },
                    ]}
                  >
                    {isUp ? '+' : ''}
                    {pc.changePct}%
                  </Text>
                </View>
                <Text style={styles.priceTileName} numberOfLines={2}>
                  {displayName}
                </Text>
                <Text style={styles.priceTileSub} numberOfLines={1}>
                  {formatCurrency(pc.firstPrice, currency, false)}
                  <Text style={styles.priceTileArrow}> → </Text>
                  {formatCurrency(pc.lastPrice, currency, false)}
                </Text>
              </Pressable>
            </Animated.View>
          );
        })}
      </View>
      <Text style={styles.priceHint}>{t('since_first')}</Text>
    </AnimatedCard>
  );
}

export default React.memo(PriceWatchCard);
