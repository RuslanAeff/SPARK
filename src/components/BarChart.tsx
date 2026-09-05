// S.P.A.R.K. — Interactive, viewport-scaled bar chart
import React, { useEffect, useMemo, useState } from 'react';
import { Pressable, ScrollView, StyleSheet, Text, View } from 'react-native';
import { MaterialCommunityIcons } from '@expo/vector-icons';
import Svg, { G, Line, Rect, Text as SvgText } from 'react-native-svg';
import Animated, {
  Easing, useAnimatedProps, useSharedValue, withTiming, type SharedValue,
} from 'react-native-reanimated';

import { useLanguage } from '../i18n/LanguageContext';
import { Colors } from '../theme/colors';
import { BorderRadius, Spacing } from '../theme/spacing';
import { FontFamily, Typography } from '../theme/typography';
import { useAppTheme, useThemeRevision } from '../theme/themeStore';
import { formatCurrency } from '../utils/formatCurrency';
import { useTabSwipe } from '../context/TabSwipeContext';
import {
  alignedPreviousSeries,
  buildChartZoomSizes,
  buildRightAlignedPageRanges,
  moveChartZoom,
  normalizeChartViewport,
  type ChartViewportState,
} from '../utils/barChartViewport';

const ARect = Animated.createAnimatedComponent(Rect);
const TOOLTIP_TOP = 4;
const TOOLTIP_RESERVED_HEIGHT = 64;

export interface BarData {
  label: string;
  value: number;
  color?: string;
  id?: string;
}

interface BarChartProps {
  data: BarData[];
  prevData?: BarData[];
  height?: number;
  defaultColor?: string;
  currency?: string;
  enableZoom?: boolean;
}

function AnimatedBar({ progress, staggerDelay, targetBarHeight, x, barWidth, chartBaseY, fill, opacity }: {
  progress: SharedValue<number>;
  staggerDelay: number;
  targetBarHeight: number;
  x: number;
  barWidth: number;
  chartBaseY: number;
  fill: string;
  opacity: number;
}) {
  const animatedProps = useAnimatedProps(() => {
    'worklet';
    const denom = 1 - staggerDelay * 0.5;
    const local = denom > 0
      ? Math.max(0, Math.min(1, (progress.value - staggerDelay * 0.5) / denom))
      : progress.value;
    const h = Math.max(targetBarHeight * local, 2);
    return { height: h, y: chartBaseY - h } as any;
  }, [targetBarHeight, chartBaseY, staggerDelay]);

  return <ARect animatedProps={animatedProps} x={x} width={barWidth} fill={fill} opacity={opacity} rx={barWidth / 2} />;
}

function formatYLabel(value: number) {
  if (value >= 1000) return `${(value / 1000).toFixed(1)}K`;
  return value.toFixed(0);
}

function compactDateLabel(item: BarData | undefined): string {
  if (!item) return '';
  const match = item.id?.match(/^(\d{4})-(\d{2})-(\d{2})$/);
  return match ? `${match[3]}.${match[2]}` : item.label;
}

function formatPageRange(data: BarData[]): string {
  const first = compactDateLabel(data[0]);
  const last = compactDateLabel(data[data.length - 1]);
  return first === last ? first : `${first}–${last}`;
}

function ChartPage({ data, prevData, height, defaultColor, currency, progress }: {
  data: BarData[];
  prevData?: BarData[];
  height: number;
  defaultColor: string;
  currency: string;
  progress: SharedValue<number>;
}) {
  const { t } = useLanguage();
  const scheme = useAppTheme();
  const themeRevision = useThemeRevision();
  const pageStyles = useMemo(() => getPageStyles(), [scheme, themeRevision]);
  const [selectedIndex, setSelectedIndex] = useState<number | null>(null);
  const width = 320;
  // Seçim balonu yatay sayfanın sınırları içinde kalmalı. Üst alanı her zaman
  // ayırmak, balon açıldığında grafiğin aşağı sıçramasını da engeller.
  const padding = { top: TOOLTIP_RESERVED_HEIGHT, right: 10, bottom: 24, left: 40 };
  const chartWidth = width - padding.left - padding.right;
  const chartHeight = height - padding.top - padding.bottom;
  const chartBaseY = padding.top + chartHeight;
  const values = data.map(item => item.value);
  // Çizim ve ölçek aynı kapıdan geçer: hizasız önceki dönem serisi çizilemediği
  // hâlde ölçeğe girerse gerçek çubuklar sıfıra yapışır.
  const prevSeries = alignedPreviousSeries(data, prevData);
  const prevValues = prevSeries ? prevSeries.map(item => item.value) : [];
  // Yakınlaştırılmış her pencere kendi ölçeğini kullanır. Başka bir haftadaki
  // uç değer, kullanıcının incelediği günleri ezmez.
  const maxVal = Math.max(...values, ...prevValues, 10);
  const totalBars = data.length;
  const barWidth = Math.min(30, Math.max(7, (chartWidth / totalBars) * 0.7));
  const spacePerBar = chartWidth / totalBars;
  const gap = spacePerBar - barWidth;

  return (
    <View style={{ height }}>
      <Svg width="100%" height={height} viewBox={`0 0 ${width} ${height}`} preserveAspectRatio="xMidYMid meet">
        {[0, 0.5, 1].map((ratio, index) => {
          const y = padding.top + chartHeight * (1 - ratio);
          return (
            <G key={`grid-${index}`}>
              <Line x1={padding.left} y1={y} x2={width - padding.right} y2={y} stroke={Colors.divider} strokeWidth={1} strokeDasharray="4,4" />
              <SvgText x={padding.left - 6} y={y + 4} fontSize="10" fill={Colors.textMuted} textAnchor="end" fontFamily={FontFamily.regular}>
                {formatYLabel(maxVal * ratio)}
              </SvgText>
            </G>
          );
        })}

        {prevSeries && data.map((_, index) => {
          const value = prevSeries[index]?.value ?? 0;
          const barH = (value / maxVal) * chartHeight;
          const x = padding.left + index * spacePerBar + gap / 2;
          return <Rect key={`prev-${index}`} x={x} y={chartBaseY - barH} width={barWidth} height={Math.max(barH, 0)} fill={Colors.textMuted} opacity={0.18} rx={barWidth / 2} />;
        })}

        {data.map((item, index) => {
          const targetBarHeight = (item.value / maxVal) * chartHeight;
          const x = padding.left + index * spacePerBar + gap / 2;
          const selected = selectedIndex === index;
          return (
            <G
              key={item.id ?? `bar-${index}`}
              testID={`bar-chart-bar-${index}`}
              onPress={() => setSelectedIndex(selected ? null : index)}
            >
              <AnimatedBar
                progress={progress}
                staggerDelay={index / totalBars}
                targetBarHeight={targetBarHeight}
                x={x}
                barWidth={barWidth}
                chartBaseY={chartBaseY}
                fill={selected ? Colors.secondary : (item.color ?? defaultColor)}
                opacity={selectedIndex !== null && !selected ? 0.3 : 1}
              />
              <Rect x={x - gap / 2} y={padding.top} width={spacePerBar} height={chartHeight} fill="transparent" />
            </G>
          );
        })}

        {data.map((item, index) => {
          const show = totalBars <= 7 || index === 0 || index === totalBars - 1 || index % Math.ceil(totalBars / 5) === 0;
          if (!show) return null;
          return (
            <SvgText
              key={`x-${item.id ?? index}`}
              x={padding.left + index * spacePerBar + spacePerBar / 2}
              y={height - 6}
              fontSize="10"
              fill={Colors.textSecondary}
              textAnchor="middle"
              fontFamily={FontFamily.medium}
            >
              {item.label}
            </SvgText>
          );
        })}
      </Svg>

      {selectedIndex !== null && data[selectedIndex] ? (
        <View testID="bar-chart-tooltip" style={pageStyles.tooltip}>
          <Text style={pageStyles.tooltipLabel}>{data[selectedIndex].label}</Text>
          <Text style={pageStyles.tooltipValue}>{formatCurrency(data[selectedIndex].value, currency, false)}</Text>
          {prevSeries && prevSeries[selectedIndex] && prevSeries[selectedIndex].value > 0 ? (
            <Text style={[
              pageStyles.tooltipPrev,
              { color: data[selectedIndex].value <= prevSeries[selectedIndex].value ? Colors.success : Colors.danger },
            ]}>
              {t('last_period')}: {formatCurrency(prevSeries[selectedIndex].value, currency, false)}
            </Text>
          ) : null}
        </View>
      ) : null}
    </View>
  );
}

export default function BarChart({
  data, prevData, height = 180, defaultColor = Colors.primary, currency = 'PLN', enableZoom = false,
}: BarChartProps) {
  const scheme = useAppTheme();
  const themeRevision = useThemeRevision();
  const styles = useMemo(() => getStyles(), [scheme, themeRevision]);
  const { t } = useLanguage();
  const { setNestedHorizontalGestureActive } = useTabSwipe();
  const [pageWidth, setPageWidth] = useState(0);
  const progress = useSharedValue(0);

  const dataKey = useMemo(() => {
    const first = data[0]?.id ?? data[0]?.label ?? '';
    const last = data[data.length - 1]?.id ?? data[data.length - 1]?.label ?? '';
    return `${data.length}:${first}:${last}`;
  }, [data]);
  const animationKey = useMemo(
    () => data.map((item, index) => `${item.id ?? index}:${item.value}`).join('|'),
    [data],
  );
  const zoomSizes = useMemo(() => buildChartZoomSizes(data.length), [data.length]);
  const [viewport, setViewport] = useState<ChartViewportState>(() => ({
    dataKey,
    zoomIndex: 0,
    pageIndex: 0,
  }));
  const normalizedViewport = normalizeChartViewport(
    viewport,
    dataKey,
    data.length,
    zoomSizes,
  );
  const { zoomIndex, pageIndex } = normalizedViewport;
  const pageSize = zoomSizes[zoomIndex] ?? data.length;
  const pageRanges = useMemo(
    () => buildRightAlignedPageRanges(data.length, pageSize),
    [data.length, pageSize],
  );
  const pages = useMemo(() => {
    return pageRanges.map(range => ({
      ...range,
      data: data.slice(range.start, range.endExclusive),
      prev: prevData?.slice(range.start, range.endExclusive),
    }));
  }, [data, pageRanges, prevData]);
  const activePage = pages[pageIndex] ?? pages[pages.length - 1];

  useEffect(() => {
    progress.value = 0;
    progress.value = withTiming(1, { duration: 650, easing: Easing.out(Easing.cubic) });
  }, [animationKey, progress]);

  useEffect(() => {
    setViewport(currentState => {
      const nextState = normalizeChartViewport(
        currentState,
        dataKey,
        data.length,
        zoomSizes,
      );
      return currentState.dataKey === nextState.dataKey
        && currentState.zoomIndex === nextState.zoomIndex
        && currentState.pageIndex === nextState.pageIndex
        ? currentState
        : nextState;
    });
  }, [data.length, dataKey, zoomSizes]);

  useEffect(() => () => setNestedHorizontalGestureActive(false), [setNestedHorizontalGestureActive]);

  if (data.length === 0) {
    return <View style={[styles.emptyContainer, { height }]}><Text style={styles.emptyText}>{t('no_data_found')}</Text></View>;
  }

  const canZoom = enableZoom && zoomSizes.length > 1;
  const setZoom = (target: number | ((current: number) => number)) => {
    setViewport(currentState => {
      const current = normalizeChartViewport(
        currentState,
        dataKey,
        data.length,
        zoomSizes,
      );
      const nextZoomIndex = typeof target === 'function'
        ? target(current.zoomIndex)
        : target;
      return moveChartZoom(
        current,
        nextZoomIndex,
        dataKey,
        data.length,
        zoomSizes,
      );
    });
  };

  return (
    <View style={styles.container}>
      <View
        testID="bar-chart-viewport"
        style={{ height }}
        onLayout={event => {
          const nextWidth = Math.round(event.nativeEvent.layout.width);
          if (nextWidth > 0 && nextWidth !== pageWidth) setPageWidth(nextWidth);
        }}
      >
        <ScrollView
          key={`bar-chart-pager-${dataKey}-${zoomIndex}-${pageWidth}`}
          testID="bar-chart-pager"
          horizontal
          pagingEnabled
          scrollEnabled={pages.length > 1}
          nestedScrollEnabled
          directionalLockEnabled
          disableIntervalMomentum
          showsHorizontalScrollIndicator={false}
          contentOffset={{ x: pageIndex * (pageWidth || 320), y: 0 }}
          onTouchStart={() => pages.length > 1 && setNestedHorizontalGestureActive(true)}
          onTouchEnd={() => setNestedHorizontalGestureActive(false)}
          onTouchCancel={() => setNestedHorizontalGestureActive(false)}
          onMomentumScrollEnd={event => {
            setNestedHorizontalGestureActive(false);
            if (pageWidth <= 0) return;
            const nextPageIndex = Math.max(
              0,
              Math.min(pages.length - 1, Math.round(event.nativeEvent.contentOffset.x / pageWidth)),
            );
            setViewport(currentState => ({
              ...normalizeChartViewport(currentState, dataKey, data.length, zoomSizes),
              pageIndex: nextPageIndex,
            }));
          }}
        >
          {pages.map((page, index) => (
            <View
              key={`chart-page-${page.start}-${page.endExclusive}`}
              testID={`bar-chart-page-${index}`}
              accessibilityLabel={formatPageRange(page.data)}
              style={{ width: pageWidth || 320 }}
            >
              <ChartPage data={page.data} prevData={page.prev} height={height} defaultColor={defaultColor} currency={currency} progress={progress} />
            </View>
          ))}
        </ScrollView>
      </View>

      {canZoom ? (
        <View style={styles.zoomPanel}>
          <View style={styles.zoomControlRow}>
            <Pressable
              testID="bar-chart-zoom-out"
              accessibilityRole="button"
              accessibilityLabel={t('chart_zoom_out')}
              accessibilityState={{ disabled: zoomIndex === 0 }}
              disabled={zoomIndex === 0}
              onPress={() => setZoom(current => current - 1)}
              style={({ pressed }) => [styles.zoomButton, zoomIndex === 0 && styles.disabled, pressed && styles.pressed]}
            >
              <MaterialCommunityIcons name="minus" size={18} color={Colors.textPrimary} />
            </Pressable>
            <View style={styles.zoomTrack} accessibilityLabel={t('chart_zoom_level')}>
              {zoomSizes.map((_, index) => (
                <Pressable
                  key={`zoom-${index}`}
                  testID={`bar-chart-zoom-${index}`}
                  accessibilityRole="button"
                  accessibilityState={{ selected: index === zoomIndex }}
                  onPress={() => setZoom(index)}
                  style={[styles.zoomDetent, index <= zoomIndex && styles.zoomDetentActive]}
                />
              ))}
            </View>
            <Pressable
              testID="bar-chart-zoom-in"
              accessibilityRole="button"
              accessibilityLabel={t('chart_zoom_in')}
              accessibilityState={{ disabled: zoomIndex === zoomSizes.length - 1 }}
              disabled={zoomIndex === zoomSizes.length - 1}
              onPress={() => setZoom(current => current + 1)}
              style={({ pressed }) => [styles.zoomButton, zoomIndex === zoomSizes.length - 1 && styles.disabled, pressed && styles.pressed]}
            >
              <MaterialCommunityIcons name="plus" size={18} color={Colors.textPrimary} />
            </Pressable>
          </View>
          <Text testID="bar-chart-page-label" style={styles.pageLabel}>
            {formatPageRange(activePage?.data ?? [])} · {pageIndex + 1}/{pages.length}
          </Text>
        </View>
      ) : null}
    </View>
  );
}

const getPageStyles = () => StyleSheet.create({
  tooltip: {
    position: 'absolute', top: TOOLTIP_TOP, alignSelf: 'center', alignItems: 'center',
    backgroundColor: Colors.surfaceElevated, paddingHorizontal: Spacing.md,
    paddingVertical: Spacing.xs, borderRadius: BorderRadius.md, borderWidth: 1,
    borderColor: Colors.border, elevation: 4, zIndex: 2,
  },
  tooltipLabel: { ...Typography.labelSmall, color: Colors.textSecondary, marginBottom: 2 },
  tooltipValue: { ...Typography.labelLarge, color: Colors.textPrimary, fontFamily: FontFamily.bold },
  tooltipPrev: { ...Typography.labelSmall, marginTop: 2 },
});

const getStyles = () => StyleSheet.create({
  container: { width: '100%', marginVertical: Spacing.sm },
  emptyContainer: { width: '100%', position: 'relative' },
  emptyText: { ...Typography.bodyMedium, color: Colors.textMuted, textAlign: 'center', marginTop: Spacing.xl },
  zoomPanel: {
    minHeight: 62, marginTop: Spacing.xs, paddingHorizontal: Spacing.sm,
    paddingVertical: Spacing.xs, alignItems: 'stretch', justifyContent: 'center', gap: 2,
    borderRadius: BorderRadius.round, backgroundColor: Colors.surfaceLight,
    borderWidth: 1, borderColor: Colors.border,
  },
  zoomControlRow: {
    minHeight: 34, flexDirection: 'row', alignItems: 'center', justifyContent: 'center', gap: Spacing.sm,
  },
  zoomButton: { width: 34, height: 34, borderRadius: 17, alignItems: 'center', justifyContent: 'center', backgroundColor: Colors.cardSurface },
  zoomTrack: { flex: 1, maxWidth: 190, flexDirection: 'row', alignItems: 'center', gap: 6 },
  zoomDetent: { flex: 1, height: 4, borderRadius: 2, backgroundColor: Colors.divider },
  zoomDetentActive: { backgroundColor: Colors.primary },
  pageLabel: { ...Typography.labelSmall, color: Colors.textMuted, textAlign: 'center' },
  disabled: { opacity: 0.35 },
  pressed: { opacity: 0.72 },
});
