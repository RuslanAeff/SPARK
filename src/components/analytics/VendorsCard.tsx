// S.P.A.R.K. — Analiz kartı: sabit yükseklikte, beşerli satıcı sayfaları.
import React, { useEffect, useMemo, useState } from 'react';
import { Pressable, ScrollView, Text, View } from 'react-native';
import { MaterialCommunityIcons } from '@expo/vector-icons';

import AnimatedCard from '../AnimatedCard';
import VendorAvatar from '../VendorAvatar';
import { Colors } from '../../theme/colors';
import { useThemeRevision } from '../../theme/themeStore';
import { formatCurrency } from '../../utils/formatCurrency';
import type { VendorSpending } from '../../db/schema';
import { CountUpText, type BaseCardProps } from './shared';
import { useTabSwipe } from '../../context/TabSwipeContext';

const VENDOR_PAGE_SIZE = 5;

interface VendorsCardProps extends BaseCardProps {
  vendors: VendorSpending[];
  prevVendorTotals: Map<number, number>;
  handleVendorPress: (vendorId: number) => void;
}

function VendorsCard({
  styles,
  t,
  currency,
  vendors,
  prevVendorTotals,
  handleVendorPress,
}: VendorsCardProps) {
  useThemeRevision();
  const { setNestedHorizontalGestureActive } = useTabSwipe();
  const [pageWidth, setPageWidth] = useState(0);
  const [pageIndex, setPageIndex] = useState(0);

  const pages = useMemo(() => {
    const result: VendorSpending[][] = [];
    for (let index = 0; index < vendors.length; index += VENDOR_PAGE_SIZE) {
      result.push(vendors.slice(index, index + VENDOR_PAGE_SIZE));
    }
    return result;
  }, [vendors]);

  useEffect(() => {
    setPageIndex(current => Math.min(current, Math.max(0, pages.length - 1)));
  }, [pages.length]);

  useEffect(
    () => () => setNestedHorizontalGestureActive(false),
    [setNestedHorizontalGestureActive],
  );

  return (
    <AnimatedCard delay={400} style={styles.section}>
      <View style={styles.vendorCardHeader}>
        <Text style={styles.sectionTitle}>{t('vendors_stores')}</Text>
        {pages.length > 1 && (
          <Text testID="vendor-page-counter" style={styles.vendorPageCounter}>
            {pageIndex + 1} / {pages.length}
          </Text>
        )}
      </View>

      <View
        testID="vendor-pager-viewport"
        onLayout={event => setPageWidth(Math.round(event.nativeEvent.layout.width))}
        style={styles.vendorPagerViewport}
      >
        <ScrollView
          testID="vendor-pager"
          horizontal
          pagingEnabled
          scrollEnabled={pages.length > 1}
          nestedScrollEnabled
          directionalLockEnabled
          disableIntervalMomentum
          decelerationRate="fast"
          showsHorizontalScrollIndicator={false}
          onTouchStart={() => pages.length > 1 && setNestedHorizontalGestureActive(true)}
          onTouchEnd={() => setNestedHorizontalGestureActive(false)}
          onTouchCancel={() => setNestedHorizontalGestureActive(false)}
          onMomentumScrollEnd={event => {
            setNestedHorizontalGestureActive(false);
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
              key={`vendor-page-${pageNumber}`}
              testID={`vendor-page-${pageNumber}`}
              style={[
                styles.vendorPage,
                pages.length > 1 && styles.vendorPageFixed,
                pageWidth > 0 && { width: pageWidth },
              ]}
            >
              {page.map((vendor, rowIndex) => {
                const previousTotal = prevVendorTotals.get(vendor.vendor_id);
                const isNewVendor = previousTotal === undefined && prevVendorTotals.size > 0;
                const delta = previousTotal && previousTotal > 0
                  ? Math.round(((vendor.total - previousTotal) / previousTotal) * 100)
                  : null;
                const isLastVisibleRow = rowIndex === page.length - 1;

                return (
                  <Pressable
                    key={vendor.vendor_id}
                    testID={`vendor-row-${vendor.vendor_id}`}
                    onPress={() => handleVendorPress(vendor.vendor_id)}
                    accessibilityRole="button"
                    accessibilityLabel={`${vendor.vendor_name}. ${t('vendor_analysis_title')}`}
                    style={({ pressed }) => [
                      styles.vendorRow,
                      isLastVisibleRow && styles.vendorRowLast,
                      pressed && styles.vendorRowPressed,
                    ]}
                  >
                    <View>
                      <VendorAvatar name={vendor.vendor_name} logoUri={vendor.vendor_logo} size={44} />
                      {isNewVendor && (
                        <View style={styles.newBadge}>
                          <Text style={styles.newBadgeText}>{t('badge_new')}</Text>
                        </View>
                      )}
                    </View>
                    <View style={styles.vendorInfo}>
                      <View style={styles.vendorNameRow}>
                        <Text style={styles.vendorName} numberOfLines={1}>{vendor.vendor_name}</Text>
                        {delta !== null && delta !== 0 && (
                          <MaterialCommunityIcons
                            name={delta > 0 ? 'arrow-up' : 'arrow-down'}
                            size={14}
                            color={delta > 0 ? Colors.danger : Colors.success}
                          />
                        )}
                      </View>
                      <View style={styles.vendorBar}>
                        <View
                          style={[
                            styles.vendorBarFill,
                            {
                              width: `${Math.max(2, vendor.percentage)}%`,
                              backgroundColor: Colors.primary,
                            },
                          ]}
                        />
                      </View>
                    </View>
                    <View style={styles.vendorAmountCol}>
                      <Text style={styles.vendorAmount}>{formatCurrency(vendor.total, currency)}</Text>
                      <CountUpText value={vendor.percentage} suffix="%" style={styles.vendorPercent} />
                    </View>
                    <MaterialCommunityIcons name="chevron-right" size={18} color={Colors.textMuted} />
                  </Pressable>
                );
              })}
            </View>
          ))}
        </ScrollView>
      </View>

      {pages.length > 1 && pages.length <= 7 && (
        <View style={styles.pricePageDots}>
          {pages.map((_, index) => (
            <View
              key={`vendor-page-dot-${index}`}
              testID={`vendor-page-dot-${index}`}
              style={[styles.pricePageDot, index === pageIndex && styles.pricePageDotActive]}
            />
          ))}
        </View>
      )}
    </AnimatedCard>
  );
}

export default React.memo(VendorsCard);
