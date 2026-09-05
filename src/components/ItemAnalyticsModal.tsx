// S.P.A.R.K. — Item Analytics Modal
// NOTE: No react-native-reanimated inside Modal to prevent Android freeze
import React, { useEffect, useState, useRef, useMemo } from 'react';
import {
  View, Text, Pressable, ScrollView, StyleSheet,
  ActivityIndicator, Dimensions,
} from 'react-native';
import { MaterialCommunityIcons } from '@expo/vector-icons';
import BottomSheetModal from './BottomSheetModal';
import { Colors } from '../theme/colors';
import { Typography, FontFamily } from '../theme/typography';
import { Spacing, BorderRadius, ScreenPadding } from '../theme/spacing';
import { formatCurrency } from '../utils/formatCurrency';
import { ExpenseDao } from '../db/expenseDao';
import LineChart from './LineChart';
import { buildAdaptivePriceHistorySeries } from '../utils/priceHistorySeries';
import { useLanguage } from '../i18n/LanguageContext';
import { useCurrency } from '../context/CurrencyContext';
import { useAppTheme, useThemeRevision } from '../theme/themeStore';
import {
  formatMeasurementQuantity,
  measurementUnitSuffix,
  sanitizeMeasurementUnit,
  type MeasurementUnit,
} from '../utils/measurementUnit';
import { useTabSwipe } from '../context/TabSwipeContext';

const HISTORY_PAGE_SIZE = 6;

interface ItemAnalyticsModalProps {
  visible: boolean;
  itemName: string;
  measurementUnit?: MeasurementUnit;
  canonicalProductId?: number | null;
  onClose: () => void;
  onDismiss?: () => void;
}

interface ItemStats {
  total_spent: number;
  avg_price: number;
  purchase_count: number;
  total_quantity: number;
  measurement_unit?: MeasurementUnit;
}

interface ItemHistoryEntry {
  name: string;
  turkish_name: string | null;
  user_label: string | null;
  date: string;
  unit_price: number;
  total_price: number;
  quantity: number;
  vendor_name: string;
  measurement_unit: MeasurementUnit;
}

// Üç özet kutusu tek bir iskeleti paylaşır: simge rozeti, tek satırlık değer ve
// iki satır için yer ayrılmış etiket. Değer sığmazsa alta taşmak yerine küçülür;
// etikete sabit yükseklik ayrılması üç kutunun taban çizgisini hizalar. Ölçü
// birimi ("/adet") değerin yanında küçük ve sönük durur, sayıyı iki satıra
// bölmez.
function StatTile({ styles, icon, tone, value, unit, label }: {
  styles: any;
  icon: React.ComponentProps<typeof MaterialCommunityIcons>['name'];
  tone: string;
  value: string;
  unit?: string;
  label: string;
}) {
  return (
    <View style={styles.statCard}>
      <View style={[styles.statIcon, { backgroundColor: tone + '1F' }]}>
        <MaterialCommunityIcons name={icon} size={14} color={tone} />
      </View>
      <View style={styles.statValueRow}>
        <Text
          style={styles.statValue}
          numberOfLines={1}
          adjustsFontSizeToFit
          minimumFontScale={0.75}
        >
          {value}
        </Text>
        {unit ? <Text style={styles.statValueUnit} numberOfLines={1}>{unit}</Text> : null}
      </View>
      <Text style={styles.statLabel} numberOfLines={2}>{label}</Text>
    </View>
  );
}

export default function ItemAnalyticsModal({
  visible,
  itemName,
  measurementUnit,
  canonicalProductId,
  onClose,
  onDismiss,
}: ItemAnalyticsModalProps) {
  const scheme = useAppTheme();
  const themeRevision = useThemeRevision();
  const styles = useMemo(() => getStyles(), [scheme, themeRevision]);
  const { t } = useLanguage();
  const { currency } = useCurrency();
  const { setNestedHorizontalGestureActive } = useTabSwipe();
  const [loading, setLoading] = useState(true);
  const [stats, setStats] = useState<ItemStats | null>(null);
  const [history, setHistory] = useState<ItemHistoryEntry[]>([]);
  const [historyPageWidth, setHistoryPageWidth] = useState(0);
  const [historyPageIndex, setHistoryPageIndex] = useState(0);
  const mountedRef = useRef(true);
  const requestSequenceRef = useRef(0);

  useEffect(() => () => {
    mountedRef.current = false;
    setNestedHorizontalGestureActive(false);
  }, [setNestedHorizontalGestureActive]);

  useEffect(() => {
    if (visible && itemName) {
      const sequence = ++requestSequenceRef.current;
      setStats(null);
      setHistory([]);
      setHistoryPageIndex(0);
      void loadData(itemName, sequence);
    } else {
      requestSequenceRef.current += 1;
      setHistoryPageIndex(0);
      setNestedHorizontalGestureActive(false);
    }
    return () => {
      requestSequenceRef.current += 1;
    };
  }, [visible, itemName, measurementUnit, canonicalProductId]);

  async function loadData(targetItemName: string, sequence: number) {
    setLoading(true);
    try {
      const result = canonicalProductId != null
        ? await ExpenseDao.getItemAnalytics(targetItemName, measurementUnit, canonicalProductId)
        : measurementUnit
          ? await ExpenseDao.getItemAnalytics(targetItemName, measurementUnit)
          : await ExpenseDao.getItemAnalytics(targetItemName);
      if (!mountedRef.current || sequence !== requestSequenceRef.current) return;
      setStats(result.stats);
      setHistory(result.history);
    } catch (e) {
      console.error('ItemAnalytics load error:', e);
    }
    if (mountedRef.current && sequence === requestSequenceRef.current) setLoading(false);
  }

  const chartSeries = useMemo(
    () => buildAdaptivePriceHistorySeries(history),
    [history],
  );
  const chartData = chartSeries.points;

  const { vendorPrices, cheapestPrice } = useMemo(() => {
    const vendorMap = new Map<string, { spent: number; quantity: number; count: number }>();
    history.forEach(h => {
      const vn = h.vendor_name || t('unknown');
      const existing = vendorMap.get(vn) || { spent: 0, quantity: 0, count: 0 };
      existing.spent += h.total_price;
      existing.quantity += h.quantity;
      existing.count += 1;
      vendorMap.set(vn, existing);
    });
    const prices: { name: string; avgPrice: number; count: number }[] = [];
    vendorMap.forEach((val, key) => {
      prices.push({
        name: key,
        avgPrice: val.quantity > 0 ? val.spent / val.quantity : 0,
        count: val.count,
      });
    });
    prices.sort((a, b) => a.avgPrice - b.avgPrice);
    return { vendorPrices: prices, cheapestPrice: prices.length > 0 ? prices[0].avgPrice : 0 };
  }, [history, t]);

  const historyPages = useMemo(() => {
    const newestFirst = [...history].reverse();
    const pages: ItemHistoryEntry[][] = [];
    for (let index = 0; index < newestFirst.length; index += HISTORY_PAGE_SIZE) {
      pages.push(newestFirst.slice(index, index + HISTORY_PAGE_SIZE));
    }
    return pages;
  }, [history]);
  const resolvedUnit = sanitizeMeasurementUnit(stats?.measurement_unit ?? measurementUnit);

  // NOT: `if (!visible) return null;` KALDIRILDI. BottomSheetModal
  // kendi mount state'ini yönetiyor; erken return kapanış animasyonunu
  // kırardı.

  return (
    <BottomSheetModal
      visible={visible}
      onClose={onClose}
      onDismiss={onDismiss}
      sheetStyle={styles.sheet}
      showHandle
      accentColor={Colors.primary}
    >

          {/* Kapat (X) yok — sürükle-kapat kulpu zaten var (gereksiz tekrar). */}
          <ScrollView showsVerticalScrollIndicator={false} contentContainerStyle={styles.scrollContent}>
            {loading ? (
              <View style={styles.loadingContainer}>
                <ActivityIndicator size="large" color={Colors.primary} />
                <Text style={styles.loadingText}>{t('loading_item_data')}</Text>
              </View>
            ) : (
              <>
                {/* Header */}
                <View>
                  <Text style={styles.itemName}>{itemName}</Text>
                  <View style={styles.badgeRow}>
                    <View style={styles.badge}>
                      <MaterialCommunityIcons name="shopping" size={12} color={Colors.primary} />
                      <Text style={styles.badgeText}>{t('purchased_count', { count: (stats?.purchase_count || 0).toString() })}</Text>
                    </View>
                    {vendorPrices.length > 0 && (
                      <View style={[styles.badge, { backgroundColor: Colors.info + '18' }]}>
                        <MaterialCommunityIcons name="store" size={12} color={Colors.info} />
                        <Text style={[styles.badgeText, { color: Colors.info }]}>
                          {t('vendor_count', { count: vendorPrices.length.toString() })}
                        </Text>
                      </View>
                    )}
                  </View>
                </View>

                {/* Stats Grid */}
                <View style={styles.statsGrid}>
                  <StatTile
                    styles={styles}
                    icon="sigma"
                    tone={Colors.danger}
                    value={formatCurrency(stats?.total_spent || 0, currency)}
                    label={t('total_spending')}
                  />
                  <StatTile
                    styles={styles}
                    icon="chart-line"
                    tone={Colors.warning}
                    value={formatCurrency(stats?.avg_price || 0, currency)}
                    unit={measurementUnitSuffix(resolvedUnit, t('measurement_unit_piece'))}
                    label={t('avg_unit_price')}
                  />
                  <StatTile
                    styles={styles}
                    icon="package-variant"
                    tone={Colors.info}
                    value={formatMeasurementQuantity(stats?.total_quantity || 0, resolvedUnit)}
                    label={resolvedUnit === 'piece' ? t('total_quantity_label') : t('total_measurement_label')}
                  />
                </View>

                {/* Price Chart */}
                {chartData.length >= 2 && (
                  <View style={styles.section}>
                    <Text style={styles.sectionTitle}>
                      <MaterialCommunityIcons name="chart-timeline-variant" size={14} color={Colors.textSecondary} />
                      {'  '}{t('price_change')}
                    </Text>
                    <LineChart
                      key={`${itemName}-${resolvedUnit}`}
                      data={chartData}
                      height={160}
                      color={Colors.primary}
                      currency={currency}
                    />
                    {chartSeries.simplified && (
                      <View style={styles.chartDensityNote}>
                        <MaterialCommunityIcons name="chart-timeline-variant-shimmer" size={13} color={Colors.textMuted} />
                        <Text style={styles.chartDensityNoteText}>
                          {t('price_chart_dense_summary', {
                            shown: chartSeries.displayedCount.toString(),
                            total: chartSeries.sourceCount.toString(),
                          })}
                        </Text>
                      </View>
                    )}
                  </View>
                )}

                {/* Vendor Comparison */}
                {vendorPrices.length > 1 && (
                  <View style={styles.section}>
                    <Text style={styles.sectionTitle}>
                      <MaterialCommunityIcons name="compare" size={14} color={Colors.textSecondary} />
                      {'  '}{t('vendor_comparison')}
                    </Text>
                    {vendorPrices.map((vp, i) => {
                      const isCheapest = vp.avgPrice === cheapestPrice;
                      const priceDiff = ((vp.avgPrice - cheapestPrice) / cheapestPrice) * 100;
                      return (
                        <View key={vp.name} style={styles.vendorCompareRow}>
                          <View style={styles.vendorCompareLeft}>
                            <View style={[styles.vendorDot, { backgroundColor: isCheapest ? Colors.success : Colors.danger }]} />
                            <Text style={styles.vendorCompareName}>{vp.name}</Text>
                          </View>
                          <View style={styles.vendorCompareRight}>
                            <Text style={[styles.vendorComparePrice, isCheapest && { color: Colors.success }]}>
                              {formatCurrency(vp.avgPrice, currency)}
                            </Text>
                            {!isCheapest && (
                              <Text style={styles.vendorCompareDiff}>+{priceDiff.toFixed(0)}%</Text>
                            )}
                            {isCheapest && (
                              <View style={styles.cheapBadge}>
                                <Text style={styles.cheapBadgeText}>{t('cheapest_label')}</Text>
                              </View>
                            )}
                          </View>
                        </View>
                      );
                    })}
                  </View>
                )}

                {/* Purchase History */}
                {history.length > 0 && (
                  <View style={styles.section}>
                    <Text style={styles.sectionTitle}>
                      <MaterialCommunityIcons name="history" size={14} color={Colors.textSecondary} />
                      {'  '}{t('purchase_history')}
                    </Text>
                    <View
                      testID="purchase-history-pager-viewport"
                      style={styles.historyPagerViewport}
                      onLayout={event => setHistoryPageWidth(Math.round(event.nativeEvent.layout.width))}
                    >
                      <ScrollView
                        testID="purchase-history-pager"
                        horizontal
                        pagingEnabled
                        nestedScrollEnabled
                        directionalLockEnabled
                        disableIntervalMomentum
                        decelerationRate="fast"
                        showsHorizontalScrollIndicator={false}
                        onTouchStart={() => setNestedHorizontalGestureActive(true)}
                        onTouchEnd={() => setNestedHorizontalGestureActive(false)}
                        onTouchCancel={() => setNestedHorizontalGestureActive(false)}
                        onMomentumScrollEnd={event => {
                          if (historyPageWidth > 0) {
                            setHistoryPageIndex(Math.round(
                              event.nativeEvent.contentOffset.x / historyPageWidth,
                            ));
                          }
                        }}
                      >
                        {historyPages.map((page, pageIndex) => (
                          <View
                            testID={`purchase-history-page-${pageIndex}`}
                            key={`history-page-${pageIndex}`}
                            style={[
                              styles.historyPage,
                              historyPageWidth > 0 && { width: historyPageWidth },
                            ]}
                          >
                            {page.map((h, rowIndex) => (
                              <View key={`${h.date}-${h.vendor_name}-${rowIndex}`} style={styles.historyRow}>
                                <View style={styles.historyDate}>
                                  <Text style={styles.historyDateText}>
                                    {h.date.split('-').reverse().join('.')}
                                  </Text>
                                </View>
                                <View style={styles.historyMid}>
                                  {!!h.name && (
                                    <Text style={styles.historyItemName} numberOfLines={1}>{h.name}</Text>
                                  )}
                                  <View style={styles.historyMetaRow}>
                                    <Text style={styles.historyVendor} numberOfLines={1}>{h.vendor_name}</Text>
                                    <Text style={styles.historyQty}>
                                      {formatMeasurementQuantity(h.quantity, h.measurement_unit)}
                                    </Text>
                                  </View>
                                </View>
                                <Text style={styles.historyPrice}>
                                  {formatCurrency(h.total_price, currency)}
                                </Text>
                              </View>
                            ))}
                          </View>
                        ))}
                      </ScrollView>
                    </View>
                    {historyPages.length > 1 && (
                      <View style={styles.historyPageDots}>
                        {historyPages.map((_, index) => (
                          <View
                            key={`history-dot-${index}`}
                            style={[
                              styles.historyPageDot,
                              index === historyPageIndex && styles.historyPageDotActive,
                            ]}
                          />
                        ))}
                      </View>
                    )}
                  </View>
                )}

                <View style={{ height: 40 }} />
              </>
            )}
          </ScrollView>
    </BottomSheetModal>
  );
}

const { height: SCREEN_H, width: SCREEN_W } = Dimensions.get('window');

const getStyles = () => StyleSheet.create({
  sheet: {
    backgroundColor: Colors.background,
    borderTopLeftRadius: 24,
    borderTopRightRadius: 24,
    maxHeight: SCREEN_H * 0.85,
    paddingTop: Spacing.sm,
    borderTopWidth: 1,
    borderColor: Colors.cardBorder,
  },
  handleBar: {
    width: 40,
    height: 4,
    borderRadius: 2,
    backgroundColor: Colors.border,
    alignSelf: 'center',
    marginBottom: Spacing.sm,
  },
  scrollContent: {
    paddingHorizontal: ScreenPadding.horizontal,
    paddingBottom: 20,
  },
  loadingContainer: {
    alignItems: 'center',
    justifyContent: 'center',
    height: 200,
    gap: Spacing.md,
  },
  loadingText: {
    ...Typography.bodyMedium,
    color: Colors.textSecondary,
  },

  // Header
  itemName: {
    ...Typography.headlineMedium,
    color: Colors.textPrimary,
    fontFamily: FontFamily.bold,
    marginBottom: Spacing.sm,
    paddingRight: 40,
  },
  badgeRow: {
    flexDirection: 'row',
    gap: Spacing.sm,
    marginBottom: Spacing.lg,
  },
  badge: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 4,
    backgroundColor: Colors.primaryGlow,
    paddingHorizontal: Spacing.sm,
    paddingVertical: 4,
    borderRadius: BorderRadius.round,
  },
  badgeText: {
    ...Typography.labelSmall,
    color: Colors.primary,
  },

  // Stats Grid
  statsGrid: {
    flexDirection: 'row',
    gap: Spacing.sm,
    marginBottom: Spacing.lg,
  },
  statCard: {
    flex: 1,
    minWidth: 0,
    backgroundColor: Colors.surface,
    borderRadius: BorderRadius.lg,
    paddingHorizontal: Spacing.md,
    paddingVertical: Spacing.md,
    gap: Spacing.sm,
    borderWidth: 1,
    borderColor: Colors.border,
  },
  statIcon: {
    width: 26,
    height: 26,
    borderRadius: 13,
    alignItems: 'center',
    justifyContent: 'center',
  },
  statValueRow: {
    flexDirection: 'row',
    alignItems: 'flex-end',
    minHeight: 22,
    gap: 2,
  },
  statValue: {
    ...Typography.bodyLarge,
    fontFamily: FontFamily.extraBold,
    color: Colors.textPrimary,
    fontSize: 17,
    lineHeight: 22,
    letterSpacing: -0.2,
    flexShrink: 1,
  },
  statValueUnit: {
    ...Typography.labelSmall,
    fontFamily: FontFamily.medium,
    color: Colors.textMuted,
    fontSize: 10,
    lineHeight: 14,
    marginBottom: 2,
  },
  statLabel: {
    ...Typography.labelSmall,
    color: Colors.textMuted,
    fontSize: 10,
    lineHeight: 13,
    // İki satır için yer ayrılır → üç kutunun yüksekliği ve taban çizgisi eşit.
    minHeight: 26,
    letterSpacing: 0.2,
  },

  // Section
  section: {
    marginBottom: Spacing.lg,
  },
  sectionTitle: {
    ...Typography.labelMedium,
    color: Colors.textSecondary,
    letterSpacing: 1.2,
    marginBottom: Spacing.md,
  },
  chartDensityNote: {
    flexDirection: 'row',
    alignItems: 'flex-start',
    gap: Spacing.xs,
    marginTop: -Spacing.xs,
    paddingHorizontal: Spacing.xs,
  },
  chartDensityNoteText: {
    ...Typography.labelSmall,
    color: Colors.textMuted,
    flex: 1,
    lineHeight: 16,
  },

  // Vendor Comparison
  vendorCompareRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    paddingVertical: Spacing.sm,
    borderBottomWidth: 1,
    borderBottomColor: Colors.divider,
  },
  vendorCompareLeft: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: Spacing.sm,
  },
  vendorDot: {
    width: 8,
    height: 8,
    borderRadius: 4,
  },
  vendorCompareName: {
    ...Typography.bodyMedium,
    color: Colors.textPrimary,
    fontFamily: FontFamily.medium,
  },
  vendorCompareRight: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: Spacing.sm,
  },
  vendorComparePrice: {
    ...Typography.bodyLarge,
    fontFamily: FontFamily.bold,
    color: Colors.textPrimary,
  },
  vendorCompareDiff: {
    ...Typography.labelSmall,
    color: Colors.danger,
    fontFamily: FontFamily.bold,
  },
  cheapBadge: {
    backgroundColor: Colors.success + '22',
    paddingHorizontal: 6,
    paddingVertical: 2,
    borderRadius: BorderRadius.round,
  },
  cheapBadgeText: {
    ...Typography.labelSmall,
    color: Colors.success,
    fontFamily: FontFamily.bold,
    fontSize: 9,
  },

  // History
  historyRow: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingVertical: Spacing.sm,
    borderBottomWidth: 1,
    borderBottomColor: Colors.divider,
  },
  historyDate: {
    width: 80,
  },
  historyDateText: {
    ...Typography.labelSmall,
    color: Colors.textMuted,
    fontFamily: FontFamily.medium,
  },
  historyMid: {
    flex: 1,
  },
  historyItemName: {
    ...Typography.labelSmall,
    color: Colors.textSecondary,
  },
  historyMetaRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: Spacing.xs,
  },
  historyVendor: {
    ...Typography.bodySmall,
    color: Colors.textPrimary,
    flex: 1,
  },
  historyQty: {
    ...Typography.labelSmall,
    color: Colors.textSecondary,
  },
  historyPrice: {
    ...Typography.bodyMedium,
    fontFamily: FontFamily.semiBold,
    color: Colors.textPrimary,
    width: 70,
    textAlign: 'right',
  },
  historyPagerViewport: {
    width: '100%',
    overflow: 'hidden',
  },
  historyPage: {
    width: SCREEN_W - ScreenPadding.horizontal * 2,
  },
  historyPageDots: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: Spacing.xs,
    paddingTop: Spacing.md,
  },
  historyPageDot: {
    width: 6,
    height: 6,
    borderRadius: 3,
    backgroundColor: Colors.divider,
  },
  historyPageDotActive: {
    width: 18,
    backgroundColor: Colors.primary,
  },
});
