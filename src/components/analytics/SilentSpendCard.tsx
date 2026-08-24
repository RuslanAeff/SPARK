// S.P.A.R.K. — Analiz kartı: Sessiz harcamalar (küçük ama tekrarlayan kalemler)
import React, { useEffect, useMemo, useState } from 'react';
import { View, Text, Pressable, ScrollView } from 'react-native';
import Animated, { FadeInDown } from 'react-native-reanimated';
import { MaterialCommunityIcons } from '@expo/vector-icons';
import AnimatedCard from '../AnimatedCard';
import { Colors } from '../../theme/colors';
import { formatCurrency } from '../../utils/formatCurrency';
import { itemDisplayName } from '../../utils/itemDisplayName';
import type { BaseCardProps, SilentSpendInfo } from './shared';
import { useTabSwipe } from '../../context/TabSwipeContext';

const SILENT_SPEND_PAGE_SIZE = 5;

interface SilentSpendCardProps extends BaseCardProps {
  silentSpendInfo: SilentSpendInfo;
  onSelectItem: (
    name: string,
    measurementUnit?: import('../../utils/measurementUnit').MeasurementUnit,
    canonicalProductId?: number | null,
  ) => void;
}

function SilentSpendCard({ styles, t, currency, silentSpendInfo, onSelectItem }: SilentSpendCardProps) {
  const { setNestedHorizontalGestureActive } = useTabSwipe();
  const [pageWidth, setPageWidth] = useState(0);
  const [pageIndex, setPageIndex] = useState(0);
  const items = silentSpendInfo.available ? silentSpendInfo.items : [];
  const pages = useMemo(() => {
    const result: typeof items[] = [];
    for (let index = 0; index < items.length; index += SILENT_SPEND_PAGE_SIZE) {
      result.push(items.slice(index, index + SILENT_SPEND_PAGE_SIZE));
    }
    return result;
  }, [items]);

  useEffect(() => {
    setPageIndex(current => Math.min(current, Math.max(0, pages.length - 1)));
  }, [pages.length]);
  useEffect(
    () => () => setNestedHorizontalGestureActive(false),
    [setNestedHorizontalGestureActive],
  );

  if (!silentSpendInfo.available) {
    return (
      <AnimatedCard delay={220} style={styles.section}>
        <View style={styles.silentHeader}>
          <View style={styles.silentHeaderLeft}>
            <MaterialCommunityIcons name="water-outline" size={18} color={Colors.textSecondary} />
            <Text style={styles.cardHeaderTitle}>{t('silent_card_title')}</Text>
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

  const { totalAmount, totalCount, distinctItems } = silentSpendInfo;
  const releaseTabSwipe = () => setNestedHorizontalGestureActive(false);
  return (
    <AnimatedCard delay={220} style={styles.section}>
      <View style={styles.silentHeader}>
        <View style={styles.silentHeaderLeft}>
          <View style={[styles.silentHeaderIcon, { backgroundColor: Colors.warning + '1F' }]}>
            <MaterialCommunityIcons name="water-outline" size={16} color={Colors.warning} />
          </View>
          <Text style={styles.cardHeaderTitle}>{t('silent_card_title')}</Text>
        </View>
        {pages.length > 1 && (
          <Text testID="silent-page-counter" style={styles.vendorPageCounter}>
            {pageIndex + 1} / {pages.length}
          </Text>
        )}
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
      <View
        testID="silent-pager-viewport"
        onLayout={event => setPageWidth(Math.round(event.nativeEvent.layout.width))}
        style={styles.silentPagerViewport}
      >
        <ScrollView
          testID="silent-pager"
          horizontal
          pagingEnabled
          scrollEnabled={pages.length > 1}
          nestedScrollEnabled
          directionalLockEnabled
          disableIntervalMomentum
          decelerationRate="fast"
          showsHorizontalScrollIndicator={false}
          onTouchStart={() => pages.length > 1 && setNestedHorizontalGestureActive(true)}
          onTouchEnd={releaseTabSwipe}
          onTouchCancel={releaseTabSwipe}
          onMomentumScrollEnd={event => {
            releaseTabSwipe();
            if (pageWidth > 0) {
              setPageIndex(Math.max(0, Math.min(
                pages.length - 1,
                Math.round(event.nativeEvent.contentOffset.x / pageWidth),
              )));
            }
          }}
        >
          {pages.map((page, pageNumber) => (
            <View
              key={`silent-page-${pageNumber}`}
              testID={`silent-page-${pageNumber}`}
              style={[
                styles.silentList,
                styles.silentPage,
                pages.length > 1 && styles.silentPageFixed,
                pageWidth > 0 && { width: pageWidth },
              ]}
            >
        {page.map((it, i) => {
          const displayName = it.canonical_name || itemDisplayName(it).primary;
          const catColor = it.category_color || Colors.warning;
          const icon = (it.category_icon as any) || 'water-outline';
          return (
            <Animated.View
              key={it.normalized_key}
              entering={FadeInDown.delay(i * 50).duration(280)}
              style={styles.silentRowWrapper}
            >
              <Pressable
                onPress={() => {
                  const name = it.canonical_name || it.name;
                  if (it.canonical_product_id != null) {
                    onSelectItem(name, it.measurement_unit, it.canonical_product_id);
                  } else if (it.measurement_unit) {
                    onSelectItem(name, it.measurement_unit);
                  } else {
                    onSelectItem(name);
                  }
                }}
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
                <Text
                  style={styles.silentRowTotal}
                  numberOfLines={1}
                  adjustsFontSizeToFit
                  minimumFontScale={0.8}
                >
                  {formatCurrency(it.total_spent, currency, false)}
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
            <View key={`silent-dot-${index}`} style={[styles.pricePageDot, index === pageIndex && styles.pricePageDotActive]} />
          ))}
        </View>
      )}
    </AnimatedCard>
  );
}

export default React.memo(SilentSpendCard);
