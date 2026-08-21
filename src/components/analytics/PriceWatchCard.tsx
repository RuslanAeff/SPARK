// S.P.A.R.K. — Analiz kartı: Fiyat takibi (price watch) — ürün bazlı zam/indirim
import React, { useEffect, useMemo, useState } from 'react';
import { View, Text, Pressable, ScrollView } from 'react-native';
import Animated, { FadeInDown } from 'react-native-reanimated';
import { MaterialCommunityIcons } from '@expo/vector-icons';
import AnimatedCard from '../AnimatedCard';
import { Colors } from '../../theme/colors';
import { formatCurrency } from '../../utils/formatCurrency';
import type { BaseCardProps, PriceChange } from './shared';
import { useTabSwipe } from '../../context/TabSwipeContext';
import { measurementUnitSuffix } from '../../utils/measurementUnit';

interface PriceWatchCardProps extends BaseCardProps {
  priceChanges: PriceChange[];
  onSelectItem: (name: string, measurementUnit?: PriceChange['measurementUnit']) => void;
}

function PriceWatchCard({ styles, t, currency, priceChanges, onSelectItem }: PriceWatchCardProps) {
  const [pageWidth, setPageWidth] = useState(0);
  const [pageIndex, setPageIndex] = useState(0);
  const { setNestedHorizontalGestureActive } = useTabSwipe();
  useEffect(
    () => () => setNestedHorizontalGestureActive(false),
    [setNestedHorizontalGestureActive],
  );
  const pages = useMemo(() => {
    const result: PriceChange[][] = [];
    for (let index = 0; index < priceChanges.length; index += 6) {
      result.push(priceChanges.slice(index, index + 6));
    }
    return result;
  }, [priceChanges]);
  if (priceChanges.length === 0) return null;
  const upCount = priceChanges.filter(p => p.changePct > 0).length;
  const downCount = priceChanges.length - upCount;
  return (
    <AnimatedCard delay={380} style={styles.section}>
      <View style={styles.priceHeader}>
        <View style={styles.priceHeaderLeft}>
          <MaterialCommunityIcons name="tag-multiple-outline" size={18} color={Colors.warning} />
          <Text style={styles.cardHeaderTitle}>{t('price_watch')}</Text>
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
      <View
        testID="price-pager-viewport"
        onLayout={event => setPageWidth(Math.round(event.nativeEvent.layout.width))}
        style={styles.pricePagerViewport}
      >
        <ScrollView
          testID="price-pager"
          horizontal
          pagingEnabled
          nestedScrollEnabled
          showsHorizontalScrollIndicator={false}
          decelerationRate="fast"
          directionalLockEnabled
          disableIntervalMomentum
          onTouchStart={() => setNestedHorizontalGestureActive(true)}
          onTouchEnd={() => setNestedHorizontalGestureActive(false)}
          onTouchCancel={() => setNestedHorizontalGestureActive(false)}
          onMomentumScrollEnd={event => {
            if (pageWidth > 0) setPageIndex(Math.round(event.nativeEvent.contentOffset.x / pageWidth));
          }}
        >
          {pages.map((page, pageNumber) => (
            <View testID={`price-page-${pageNumber}`} key={`price-page-${pageNumber}`} style={[styles.priceGrid, pageWidth > 0 && { width: pageWidth }]}>
              {page.map((pc, i) => {
          const isUp = pc.changePct > 0;
          const displayName = pc.turkishName || pc.name;
          return (
            <Animated.View
              key={`${pc.name}-${pageNumber}-${i}`}
              entering={FadeInDown.delay(i * 40).duration(260)}
              style={styles.priceTile}
            >
              <Pressable
                onPress={() => onSelectItem(pc.name, pc.measurementUnit)}
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
                  <Text style={styles.priceTileArrow}>
                    {measurementUnitSuffix(pc.measurementUnit, t('measurement_unit_piece'))}
                  </Text>
                </Text>
              </Pressable>
            </Animated.View>
          );
              })}
            </View>
          ))}
        </ScrollView>
      </View>
      {pages.length > 1 && (
        <View style={styles.pricePageDots}>
          {pages.map((_, index) => (
            <View key={`price-dot-${index}`} style={[styles.pricePageDot, index === pageIndex && styles.pricePageDotActive]} />
          ))}
        </View>
      )}
      <Text style={styles.priceHint}>{t('since_first')}</Text>
    </AnimatedCard>
  );
}

export default React.memo(PriceWatchCard);
