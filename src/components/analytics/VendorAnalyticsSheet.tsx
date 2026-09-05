// S.P.A.R.K. — Satıcı ayrıntısını ana analiz kartından ayıran yüksek alt panel.
import React, { useEffect, useMemo, useRef, useState } from 'react';
import {
  ActivityIndicator,
  Dimensions,
  Pressable,
  ScrollView,
  StyleSheet,
  Text,
  View,
} from 'react-native';
import { MaterialCommunityIcons } from '@expo/vector-icons';

import BottomSheetModal from '../BottomSheetModal';
import DonutChart from '../DonutChart';
import VendorAvatar from '../VendorAvatar';
import { ChartColorArray, Colors } from '../../theme/colors';
import { useAppTheme, useThemeRevision } from '../../theme/themeStore';
import { BorderRadius, ScreenPadding, Spacing } from '../../theme/spacing';
import { FontFamily, Typography } from '../../theme/typography';
import { formatCurrency } from '../../utils/formatCurrency';
import { itemDisplayName } from '../../utils/itemDisplayName';
import type { VendorSpending } from '../../db/schema';
import type { BaseCardProps } from './shared';
import { useTabSwipe } from '../../context/TabSwipeContext';

type VendorItemSort = 'frequency' | 'spending';
const PRODUCT_PAGE_SIZE = 5;
const SCREEN_HEIGHT = Dimensions.get('window').height;

interface VendorItem {
  name: string;
  turkish_name?: string | null;
  user_label?: string | null;
  canonical_product_id?: number | null;
  canonical_name?: string | null;
  measurement_unit?: import('../../utils/measurementUnit').MeasurementUnit;
  normalized_key?: string | null;
  purchase_count: number;
  total_spent: number;
}

interface VendorAnalyticsSheetProps extends Pick<BaseCardProps, 't' | 'currency' | 'styles'> {
  visible: boolean;
  vendor: VendorSpending | null;
  items: VendorItem[];
  loading: boolean;
  onClose: () => void;
  onSuspendForItem: () => void;
  onSelectItem: (
    name: string,
    measurementUnit?: import('../../utils/measurementUnit').MeasurementUnit,
    canonicalProductId?: number | null,
  ) => void;
}

export default function VendorAnalyticsSheet({
  visible,
  vendor,
  items,
  loading,
  onClose,
  onSuspendForItem,
  onSelectItem,
  t,
  currency,
  styles: analyticsStyles,
}: VendorAnalyticsSheetProps) {
  const scheme = useAppTheme();
  const themeRevision = useThemeRevision();
  const styles = useMemo(() => getStyles(), [scheme, themeRevision]);
  const { setNestedHorizontalGestureActive } = useTabSwipe();
  const [displayVendor, setDisplayVendor] = useState<VendorSpending | null>(vendor);
  const [displayItems, setDisplayItems] = useState<VendorItem[]>(items);
  const [selectedDonutIndex, setSelectedDonutIndex] = useState<number | null>(null);
  const [sort, setSort] = useState<VendorItemSort>('frequency');
  const [pageWidth, setPageWidth] = useState(0);
  const [pageIndex, setPageIndex] = useState(0);
  const pendingItem = useRef<VendorItem | null>(null);

  useEffect(() => {
    if (vendor) setDisplayVendor(vendor);
  }, [vendor]);

  useEffect(() => {
    if (visible) setDisplayItems(items);
  }, [items, visible]);

  // Açık panel her zaman yeni prop'ları kullanır; snapshot'lar yalnız kapanış
  // animasyonu boyunca içeriğin kaybolmaması için tutulur.
  const activeVendor = visible ? (vendor ?? displayVendor) : displayVendor;
  const activeItems = visible ? items : displayItems;

  useEffect(() => {
    if (!vendor) return;
    setSelectedDonutIndex(null);
    setSort('frequency');
    setPageIndex(0);
  }, [vendor?.vendor_id]);

  useEffect(() => {
    setPageIndex(0);
  }, [sort, selectedDonutIndex]);

  useEffect(
    () => () => setNestedHorizontalGestureActive(false),
    [setNestedHorizontalGestureActive],
  );

  const sortedItems = useMemo(() => [...activeItems].sort((a, b) => {
    if (sort === 'spending') {
      return (Number(b.total_spent) || 0) - (Number(a.total_spent) || 0)
        || (Number(b.purchase_count) || 0) - (Number(a.purchase_count) || 0);
    }
    return (Number(b.purchase_count) || 0) - (Number(a.purchase_count) || 0)
      || (Number(b.total_spent) || 0) - (Number(a.total_spent) || 0);
  }), [activeItems, sort]);

  const visibleItems = selectedDonutIndex === null
    ? sortedItems
    : [activeItems[selectedDonutIndex]].filter(Boolean);
  const pages = useMemo(() => {
    const result: VendorItem[][] = [];
    for (let index = 0; index < visibleItems.length; index += PRODUCT_PAGE_SIZE) {
      result.push(visibleItems.slice(index, index + PRODUCT_PAGE_SIZE));
    }
    return result;
  }, [visibleItems]);

  const donutItems = activeItems.slice(0, 8);
  const donutTotal = donutItems.reduce((sum, item) => sum + (Number(item.total_spent) || 0), 0);
  const selectedDonutItem = selectedDonutIndex === null
    ? null
    : donutItems[selectedDonutIndex] ?? null;

  const closeNormally = () => {
    pendingItem.current = null;
    setNestedHorizontalGestureActive(false);
    onClose();
  };

  const openProductAfterDismiss = (item: VendorItem) => {
    pendingItem.current = item;
    setNestedHorizontalGestureActive(false);
    onSuspendForItem();
  };

  const handleDismiss = () => {
    const item = pendingItem.current;
    pendingItem.current = null;
    if (item) {
      const displayName = item.canonical_name || item.user_label || item.turkish_name || item.name;
      if (item.measurement_unit !== undefined || item.canonical_product_id !== undefined) {
        onSelectItem(displayName, item.measurement_unit, item.canonical_product_id);
      } else {
        onSelectItem(displayName);
      }
    }
  };

  return (
    <BottomSheetModal
      visible={visible}
      onClose={closeNormally}
      onDismiss={handleDismiss}
      sheetStyle={styles.sheet}
      showHandle
      accentColor={Colors.primary}
    >
      <ScrollView
        testID="vendor-analytics-sheet-scroll"
        showsVerticalScrollIndicator={false}
        contentContainerStyle={styles.scrollContent}
      >
        <View style={styles.titleRow}>
          <View style={styles.headerIdentity}>
            {activeVendor && (
              <VendorAvatar
                name={activeVendor.vendor_name}
                logoUri={activeVendor.vendor_logo}
                size={54}
              />
            )}
            <View style={styles.headerText}>
              <Text style={styles.eyebrow}>{t('vendor_analysis_title')}</Text>
              <Text style={styles.vendorTitle} numberOfLines={2}>
                {activeVendor?.vendor_name ?? ''}
              </Text>
            </View>
          </View>
        </View>

        {activeVendor && (
          <View style={styles.summaryRow}>
            <View>
              <Text style={styles.summaryLabel}>{t('sort_by_total_spent')}</Text>
              <Text style={styles.summaryValue}>{formatCurrency(activeVendor.total, currency)}</Text>
            </View>
            <View style={styles.shareBadge}>
              <Text style={styles.shareValue}>{Math.round(activeVendor.percentage)}%</Text>
              <Text style={styles.shareLabel}>{t('of_total')}</Text>
            </View>
          </View>
        )}

        {loading && activeItems.length === 0 ? (
          <View style={styles.loadingContainer}>
            <ActivityIndicator size="small" color={Colors.primary} />
          </View>
        ) : activeItems.length === 0 ? (
          <View style={styles.emptyContainer}>
            <MaterialCommunityIcons name="package-variant-closed" size={34} color={Colors.textMuted} />
            <Text style={styles.emptyText}>{t('vendor_no_products')}</Text>
          </View>
        ) : (
          <>
            {activeItems.length >= 2 && (
              <View style={analyticsStyles.vendorDonutSection}>
                <DonutChart
                  segments={donutItems.map((item, index) => ({
                    label: item.canonical_name || item.user_label || item.turkish_name || item.name,
                    value: item.total_spent,
                    color: ChartColorArray[index % ChartColorArray.length],
                  }))}
                  size={180}
                  strokeWidth={26}
                  selectedIndex={selectedDonutIndex}
                  onSelect={index => setSelectedDonutIndex(previous => previous === index ? null : index)}
                  innerContent={(
                    <Pressable
                      onPress={() => setSelectedDonutIndex(null)}
                      style={({ pressed }) => [
                        analyticsStyles.vendorDonutCenter,
                        selectedDonutIndex !== null && pressed && analyticsStyles.vendorDonutCenterPressed,
                      ]}
                      hitSlop={12}
                      accessibilityRole="button"
                      accessibilityLabel={t('donut_center_clear')}
                    >
                      {selectedDonutItem ? (
                        <>
                          <Text
                            style={[
                              analyticsStyles.vendorDonutPct,
                              { color: ChartColorArray[selectedDonutIndex! % ChartColorArray.length] },
                            ]}
                          >
                            {donutTotal > 0
                              ? Math.round((selectedDonutItem.total_spent / donutTotal) * 100)
                              : 0}%
                          </Text>
                          <Text style={analyticsStyles.vendorDonutLabel} numberOfLines={2}>
                            {selectedDonutItem.canonical_name || selectedDonutItem.user_label || selectedDonutItem.turkish_name || selectedDonutItem.name}
                          </Text>
                          <Text style={analyticsStyles.vendorDonutSub}>
                            {formatCurrency(selectedDonutItem.total_spent, currency, false)}
                          </Text>
                        </>
                      ) : (
                        <>
                          <Text style={analyticsStyles.vendorDonutTotal}>{activeItems.length}</Text>
                          <Text style={analyticsStyles.vendorDonutLabel}>{t('product_variety')}</Text>
                        </>
                      )}
                    </Pressable>
                  )}
                />

                <View style={analyticsStyles.legendGrid}>
                  {donutItems.map((item, index) => {
                    const percentage = donutTotal > 0
                      ? Math.round((item.total_spent / donutTotal) * 100)
                      : 0;
                    const selected = selectedDonutIndex === index;
                    const color = ChartColorArray[index % ChartColorArray.length];
                    return (
                      <Pressable
                        key={item.normalized_key ?? `${item.name}-${index}`}
                        onPress={() => setSelectedDonutIndex(selected ? null : index)}
                        style={[
                          analyticsStyles.legendItem,
                          selected && { borderColor: color, backgroundColor: `${color}18` },
                        ]}
                      >
                        <View style={[analyticsStyles.legendDot, { backgroundColor: color }]} />
                        <Text style={analyticsStyles.legendText} numberOfLines={1}>
                          {item.canonical_name || item.user_label || item.turkish_name || item.name}
                        </Text>
                        <Text style={[analyticsStyles.legendPct, selected && { color }]}>
                          {percentage}%
                        </Text>
                      </Pressable>
                    );
                  })}
                </View>
              </View>
            )}

            <Text style={[analyticsStyles.microTitle, styles.productsTitle]}>
              {selectedDonutItem
                ? `🔍 ${selectedDonutItem.canonical_name || selectedDonutItem.user_label || selectedDonutItem.turkish_name || selectedDonutItem.name}`
                : t(sort === 'frequency' ? 'top_bought_products' : 'top_spent_products')}
            </Text>

            {selectedDonutIndex === null && activeItems.length > 1 && (
              <View style={analyticsStyles.vendorItemSortControl}>
                {(['frequency', 'spending'] as const).map(option => {
                  const active = sort === option;
                  return (
                    <Pressable
                      key={option}
                      testID={`vendor-item-sort-${option}`}
                      accessibilityRole="button"
                      accessibilityState={{ selected: active }}
                      onPress={() => setSort(option)}
                      style={({ pressed }) => [
                        analyticsStyles.vendorItemSortButton,
                        active && analyticsStyles.vendorItemSortButtonActive,
                        pressed && { opacity: 0.78 },
                      ]}
                    >
                      <MaterialCommunityIcons
                        name={option === 'frequency' ? 'sort-numeric-descending' : 'cash-multiple'}
                        size={14}
                        color={active ? Colors.primary : Colors.textMuted}
                      />
                      <Text style={[
                        analyticsStyles.vendorItemSortText,
                        active && analyticsStyles.vendorItemSortTextActive,
                      ]}>
                        {t(option === 'frequency' ? 'sort_by_purchase_count' : 'sort_by_total_spent')}
                      </Text>
                    </Pressable>
                  );
                })}
              </View>
            )}

            <View
              testID="vendor-item-pager-viewport"
              onLayout={event => setPageWidth(Math.round(event.nativeEvent.layout.width))}
              style={analyticsStyles.vendorItemPagerViewport}
            >
              <ScrollView
                key={`vendor-items-${activeVendor?.vendor_id}-${sort}-${selectedDonutIndex ?? 'all'}`}
                testID="vendor-item-pager"
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
                    key={`vendor-item-page-${pageNumber}`}
                    testID={`vendor-item-page-${pageNumber}`}
                    style={[
                      selectedDonutIndex === null && analyticsStyles.vendorItemPage,
                      pageWidth > 0 && { width: pageWidth },
                    ]}
                  >
                    {page.map((item, itemIndex) => {
                      const displayName = item.canonical_name
                        ? {
                            primary: item.canonical_name,
                            secondary: item.name === item.canonical_name ? null : item.name,
                          }
                        : itemDisplayName(item);
                      return (
                        <Pressable
                          key={item.normalized_key ?? `${item.name}-${itemIndex}`}
                          style={analyticsStyles.microItem}
                          onPress={() => openProductAfterDismiss(item)}
                        >
                          <View style={analyticsStyles.microItemContent}>
                            <View style={analyticsStyles.microItemMain}>
                              <Text style={analyticsStyles.microItemPrimary} numberOfLines={1}>
                                {displayName.primary}
                              </Text>
                              <Text style={analyticsStyles.microItemSecondary} numberOfLines={1}>
                                {displayName.secondary ? `${displayName.secondary}  •  ` : ''}
                                {t('pieces', { count: item.purchase_count.toString() })}
                              </Text>
                            </View>
                            <View style={analyticsStyles.microItemPriceCol}>
                              <Text style={analyticsStyles.microItemAmount}>
                                {formatCurrency(item.total_spent, currency, false)}
                              </Text>
                              <MaterialCommunityIcons name="chevron-right" size={16} color={Colors.borderLight} />
                            </View>
                          </View>
                          {itemIndex < page.length - 1 && <View style={analyticsStyles.microItemDivider} />}
                        </Pressable>
                      );
                    })}
                  </View>
                ))}
              </ScrollView>
            </View>

            {pages.length > 1 && (
              <View style={analyticsStyles.pricePageDots}>
                {pages.map((_, index) => (
                  <View
                    key={`vendor-item-dot-${index}`}
                    testID={`vendor-item-dot-${index}`}
                    style={[
                      analyticsStyles.pricePageDot,
                      index === pageIndex && analyticsStyles.pricePageDotActive,
                    ]}
                  />
                ))}
              </View>
            )}
          </>
        )}
      </ScrollView>
    </BottomSheetModal>
  );
}

const getStyles = () => StyleSheet.create({
  sheet: {
    backgroundColor: Colors.background,
    borderTopLeftRadius: BorderRadius.xxl,
    borderTopRightRadius: BorderRadius.xxl,
    borderTopWidth: 1,
    borderColor: Colors.cardBorder,
    maxHeight: SCREEN_HEIGHT * 0.92,
    paddingTop: Spacing.xs,
  },
  scrollContent: {
    paddingHorizontal: ScreenPadding.horizontal,
    paddingBottom: Spacing.xxl,
  },
  titleRow: {
    flexDirection: 'row',
    alignItems: 'flex-start',
    justifyContent: 'space-between',
    gap: Spacing.md,
    marginBottom: Spacing.lg,
  },
  headerIdentity: {
    flex: 1,
    flexDirection: 'row',
    alignItems: 'center',
    gap: Spacing.md,
  },
  headerText: { flex: 1, gap: 2 },
  eyebrow: {
    ...Typography.labelSmall,
    color: Colors.textMuted,
    textTransform: 'uppercase',
    letterSpacing: 1.2,
  },
  vendorTitle: {
    ...Typography.headlineSmall,
    color: Colors.textPrimary,
    fontFamily: FontFamily.bold,
  },
  summaryRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    borderRadius: BorderRadius.lg,
    backgroundColor: Colors.surfaceElevated,
    borderWidth: 1,
    borderColor: Colors.border,
    padding: Spacing.lg,
    marginBottom: Spacing.xl,
  },
  summaryLabel: { ...Typography.labelSmall, color: Colors.textMuted },
  summaryValue: {
    ...Typography.headlineSmall,
    color: Colors.textPrimary,
    fontFamily: FontFamily.bold,
  },
  shareBadge: {
    alignItems: 'flex-end',
    backgroundColor: Colors.primaryGlow,
    borderRadius: BorderRadius.md,
    paddingHorizontal: Spacing.md,
    paddingVertical: Spacing.sm,
  },
  shareValue: {
    ...Typography.bodyLarge,
    color: Colors.primary,
    fontFamily: FontFamily.bold,
  },
  shareLabel: { ...Typography.labelSmall, color: Colors.textSecondary },
  loadingContainer: { height: 220, alignItems: 'center', justifyContent: 'center' },
  emptyContainer: {
    minHeight: 220,
    alignItems: 'center',
    justifyContent: 'center',
    gap: Spacing.sm,
  },
  emptyText: { ...Typography.bodyMedium, color: Colors.textMuted, textAlign: 'center' },
  productsTitle: { marginTop: Spacing.lg },
});
