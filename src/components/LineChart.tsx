// S.P.A.R.K. — Interactive price-history chart
import React, { useEffect, useMemo, useState } from 'react';
import { View, Text, StyleSheet, Pressable } from 'react-native';
import { MaterialCommunityIcons } from '@expo/vector-icons';
import Svg, { Path, Circle, Line, G, Defs, LinearGradient, Stop, Text as SvgText } from 'react-native-svg';
import { Colors } from '../theme/colors';
import { useAppTheme, useThemeRevision } from '../theme/themeStore';
import { Typography, FontFamily } from '../theme/typography';
import { Spacing, BorderRadius } from '../theme/spacing';
import { formatCurrency } from '../utils/formatCurrency';
import { getCurrencyLocale } from '../utils/currencyMeta';
import { useLanguage } from '../i18n/LanguageContext';

export interface LinePoint {
  label: string;
  value: number;
  meta?: string; // optional inspection context, e.g. vendor
  /** Optional ordinal/time position used to preserve spacing after sampling. */
  position?: number;
}

interface LineChartProps {
  data: LinePoint[];
  height?: number;
  color?: string;
  currency?: string;
  showDots?: boolean;
}

export function formatLineChartAxisValue(
  value: number,
  tickStep: number,
  currency: string,
): string {
  if (value >= 1000) {
    const compactStep = tickStep / 1000;
    const compactDigits = compactStep < 0.1 ? 2 : 1;
    const compactFormatter = new Intl.NumberFormat(getCurrencyLocale(currency), {
      minimumFractionDigits: compactDigits,
      maximumFractionDigits: compactDigits,
    });
    return `${compactFormatter.format(value / 1000)}K`;
  }
  const fractionDigits = tickStep < 10 ? 2 : tickStep < 100 ? 1 : 0;
  const formatter = new Intl.NumberFormat(getCurrencyLocale(currency), {
    minimumFractionDigits: fractionDigits,
    maximumFractionDigits: fractionDigits,
  });
  return formatter.format(value);
}

/**
 * Yoğun serilerde bütün gözlemlere işaret koymak çizgiyi okunamaz hale getirir.
 * Çizgi ve dokunulabilir gözlemler aynen kalır; yalnız görsel işaretler ilk/son,
 * en belirgin yerel uçlar ve dengeli ara örneklerle sınırlandırılır.
 */
export function getLineChartMarkerIndices(
  data: LinePoint[],
  maxMarkers: number = 12,
): number[] {
  const limit = Math.max(2, Math.floor(maxMarkers));
  if (data.length <= limit) return data.map((_, index) => index);

  const selected = new Set<number>([0, data.length - 1]);
  const extrema = data
    .slice(1, -1)
    .map((point, offset) => {
      const index = offset + 1;
      const previous = data[index - 1].value;
      const next = data[index + 1].value;
      const isExtremum =
        (point.value > previous && point.value > next) ||
        (point.value < previous && point.value < next);
      return {
        index,
        isExtremum,
        salience: Math.abs(point.value - ((previous + next) / 2)),
      };
    })
    .filter((candidate) => candidate.isExtremum)
    .sort((a, b) => b.salience - a.salience || a.index - b.index);

  for (const candidate of extrema) {
    if (selected.size >= limit) break;
    selected.add(candidate.index);
  }

  // Uçlar azsa kalan kapasiteyi zaman eksenine eşit yayılmış gözlemlerle doldur.
  for (let slot = 1; selected.size < limit && slot < limit - 1; slot += 1) {
    selected.add(Math.round((slot * (data.length - 1)) / (limit - 1)));
  }

  return [...selected].sort((a, b) => a - b);
}

/** Select x-axis labels by rendered distance so sampled dates never overlap. */
export function getLineChartXLabelIndices(
  xCoordinates: number[],
  minSpacing: number = 42,
): number[] {
  if (xCoordinates.length <= 1) return xCoordinates.map((_, index) => index);

  const lastIndex = xCoordinates.length - 1;
  const selected = [0];
  let lastSelectedX = xCoordinates[0];
  const finalX = xCoordinates[lastIndex];

  for (let index = 1; index < lastIndex; index += 1) {
    const x = xCoordinates[index];
    if (x - lastSelectedX >= minSpacing && finalX - x >= minSpacing) {
      selected.push(index);
      lastSelectedX = x;
    }
  }
  selected.push(lastIndex);
  return selected;
}

export default function LineChart({
  data,
  height = 160,
  color = Colors.primary,
  currency = 'PLN',
  showDots = true,
}: LineChartProps) {
  const scheme = useAppTheme();
  const themeRevision = useThemeRevision();
  const styles = useMemo(() => getStyles(), [scheme, themeRevision]);
  const { t } = useLanguage();
  const [selectedIndex, setSelectedIndex] = useState<number | null>(null);
  const [layoutWidth, setLayoutWidth] = useState(320);

  // A different item/data set must never inherit an old inspection state.
  useEffect(() => {
    setSelectedIndex(null);
  }, [data]);

  const width = 320;
  const padding = { top: 28, right: 16, bottom: 28, left: 44 };
  const chartWidth = width - padding.left - padding.right;
  const chartHeight = height - padding.top - padding.bottom;

  if (data.length === 0) {
    return (
      <View style={[styles.container, { height }]}>
        <Text style={styles.emptyText}>{t('no_data_found')}</Text>
      </View>
    );
  }

  const values = data.map(d => d.value);
  const minVal = Math.min(...values);
  const maxVal = Math.max(...values);
  const valueRange = maxVal - minVal || 1; // avoid division by zero
  const yPadding = valueRange * 0.15; // 15% vertical breathing room
  const yMin = Math.max(0, minVal - yPadding);
  const yMax = maxVal + yPadding;
  const yRange = yMax - yMin || 1;

  const xPositions = data.map((datum, index) => (
    typeof datum.position === 'number' && Number.isFinite(datum.position)
      ? datum.position
      : index
  ));
  const xMin = Math.min(...xPositions);
  const xMax = Math.max(...xPositions);
  const xRange = xMax - xMin || 1;

  // Map data to pixel coordinates. Sampled price points carry their original
  // observation index so removed plateaus do not become visually shorter.
  const points = data.map((d, i) => ({
    x: padding.left + ((xPositions[i] - xMin) / xRange) * chartWidth,
    y: padding.top + chartHeight - ((d.value - yMin) / yRange) * chartHeight,
  }));

  // Connect recorded observations directly. Bezier smoothing can imply price
  // peaks or dips that were never observed between purchases.
  const buildPath = (): string => {
    return points
      .map((point, index) => `${index === 0 ? 'M' : 'L'} ${point.x} ${point.y}`)
      .join(' ');
  };

  // Build area path (for gradient fill)
  const buildAreaPath = (): string => {
    const linePath = buildPath();
    const lastX = points[points.length - 1].x;
    const firstX = points[0].x;
    const bottomY = padding.top + chartHeight;
    return `${linePath} L ${lastX} ${bottomY} L ${firstX} ${bottomY} Z`;
  };

  const formatYLabel = (v: number) => {
    const tickStep = yRange / 2;
    return formatLineChartAxisValue(v, tickStep, currency);
  };

  const handlePress = (index: number) => {
    setSelectedIndex(current => current === index ? null : index);
  };

  const selectedDatum = selectedIndex === null ? null : data[selectedIndex] ?? null;
  const selectedPoint = selectedIndex === null ? null : points[selectedIndex] ?? null;
  const denseData = data.length > 16;
  const markerIndices = new Set(getLineChartMarkerIndices(data));
  const xLabelMinSpacing = data.some((datum) => datum.label.length > 5) ? 56 : 42;
  const xLabelIndices = new Set(getLineChartXLabelIndices(
    points.map((point) => point.x),
    xLabelMinSpacing,
  ));
  const contentScale = Math.min(layoutWidth / width, 1);
  const contentOffsetX = (layoutWidth - width * contentScale) / 2;
  const contentOffsetY = (height - height * contentScale) / 2;

  const selectNearestPoint = (locationX: number) => {
    const renderedPlotWidth = Math.max(1, chartWidth * contentScale);
    const clampedX = Math.max(0, Math.min(renderedPlotWidth, locationX));
    const viewBoxX = padding.left + (clampedX / renderedPlotWidth) * chartWidth;
    let nearestIndex = 0;
    let nearestDistance = Number.POSITIVE_INFINITY;
    points.forEach((point, index) => {
      const distance = Math.abs(point.x - viewBoxX);
      if (distance < nearestDistance) {
        nearestDistance = distance;
        nearestIndex = index;
      }
    });
    handlePress(nearestIndex);
  };

  const moveAccessibleSelection = (direction: -1 | 1) => {
    setSelectedIndex((current) => {
      if (current === null) return direction > 0 ? 0 : data.length - 1;
      return Math.max(0, Math.min(data.length - 1, current + direction));
    });
  };

  const accessibleValue = selectedDatum
    ? [selectedDatum.label, formatCurrency(selectedDatum.value, currency), selectedDatum.meta]
      .filter(Boolean)
      .join(', ')
    : t('chart_point_hint');

  return (
    <View style={styles.container}>
      <View style={[styles.inspector, selectedDatum && styles.inspectorSelected]}>
        {selectedDatum ? (
          <>
            <View
              testID="line-chart-selection"
              style={styles.selectionSummary}
              accessible
              accessibilityLiveRegion="polite"
              accessibilityLabel={[
                selectedDatum.label,
                formatCurrency(selectedDatum.value, currency),
                selectedDatum.meta,
              ].filter(Boolean).join(', ')}
            >
              <View style={styles.selectionMarker} />
              <View style={styles.selectionIdentity}>
                <Text style={styles.selectionDate}>{selectedDatum.label}</Text>
                {selectedDatum.meta ? (
                  <Text style={styles.selectionMeta} numberOfLines={1}>
                    {selectedDatum.meta}
                  </Text>
                ) : null}
              </View>
              <Text style={styles.selectionValue} numberOfLines={1}>
                {formatCurrency(selectedDatum.value, currency)}
              </Text>
            </View>
            <Pressable
              testID="line-chart-clear-selection"
              style={({ pressed }) => [styles.clearButton, pressed && styles.clearButtonPressed]}
              onPress={() => setSelectedIndex(null)}
              hitSlop={4}
              accessibilityRole="button"
              accessibilityLabel={t('chart_clear_selection')}
            >
              <MaterialCommunityIcons name="close" size={18} color={Colors.textSecondary} />
            </Pressable>
          </>
        ) : (
          <View testID="line-chart-selection-hint" style={styles.inspectorHint}>
            <MaterialCommunityIcons name="gesture-tap" size={16} color={Colors.primary} />
            <Text style={styles.inspectorHintText}>{t('chart_point_hint')}</Text>
          </View>
        )}
      </View>

      <View
        style={[styles.chartStage, { height }]}
        onLayout={(event) => {
          const nextWidth = event.nativeEvent.layout.width;
          if (nextWidth > 0 && nextWidth !== layoutWidth) setLayoutWidth(nextWidth);
        }}
      >
        <Svg
          width="100%"
          height={height}
          viewBox={`0 0 ${width} ${height}`}
          preserveAspectRatio="xMidYMid meet"
          pointerEvents="none"
        >
        <Defs>
          <LinearGradient id="areaGrad" x1="0" y1="0" x2="0" y2="1">
            <Stop offset="0" stopColor={color} stopOpacity="0.25" />
            <Stop offset="1" stopColor={color} stopOpacity="0.02" />
          </LinearGradient>
        </Defs>

        {/* Horizontal Grid Lines */}
        {[0, 0.5, 1].map((ratio, i) => {
          const val = yMin + yRange * ratio;
          const y = padding.top + chartHeight * (1 - ratio);
          return (
            <G key={`grid-${i}`}>
              <Line
                x1={padding.left}
                y1={y}
                x2={width - padding.right}
                y2={y}
                stroke={Colors.divider}
                strokeWidth={1}
                strokeDasharray="4,4"
              />
              <SvgText
                x={padding.left - 6}
                y={y + 4}
                fontSize="9"
                fill={Colors.textMuted}
                textAnchor="end"
                fontFamily={FontFamily.regular}
              >
                {formatYLabel(val)}
              </SvgText>
            </G>
          );
        })}

        {/* Gradient Fill Area */}
        {points.length >= 2 && (
          <Path d={buildAreaPath()} fill="url(#areaGrad)" />
        )}

        {/* Line */}
        <Path
          d={buildPath()}
          stroke={color}
          strokeWidth={2.5}
          fill="none"
          strokeLinecap="round"
          strokeLinejoin="round"
        />

        {/* Selected observation is tied to a guide, not a floating overlay. */}
        {selectedPoint && (
          <G pointerEvents="none">
            <Line
              x1={selectedPoint.x}
              y1={padding.top}
              x2={selectedPoint.x}
              y2={padding.top + chartHeight}
              stroke={color}
              strokeWidth={1}
              strokeDasharray="3,3"
              opacity={0.55}
            />
            <Circle cx={selectedPoint.x} cy={selectedPoint.y} r={9} fill={color} opacity={0.18} />
          </G>
        )}

        {/* Data points are visual only; the single plot surface owns interaction. */}
        {showDots && points.map((p, i) => {
          const isSelected = selectedIndex === i;
          if (!isSelected && !markerIndices.has(i)) return null;
          return (
            <G key={`dot-${i}`} pointerEvents="none">
              <Circle
                testID={`line-chart-marker-${i}`}
                cx={p.x}
                cy={p.y}
                r={isSelected ? 5 : denseData ? 2.75 : 3.5}
                fill={isSelected ? Colors.background : color}
                stroke={color}
                strokeWidth={isSelected ? 2.5 : 1.5}
              />
            </G>
          );
        })}

        {/* X Axis Labels */}
        {data.map((d, i) => {
          if (!xLabelIndices.has(i)) return null;
          return (
            <SvgText
              key={`xl-${i}`}
              testID={`line-chart-x-label-${i}`}
              x={points[i].x}
              y={height - 6}
              fontSize="9"
              fill={Colors.textSecondary}
              textAnchor={i === 0 ? 'start' : i === data.length - 1 ? 'end' : 'middle'}
              fontFamily={FontFamily.medium}
            >
              {d.label}
            </SvgText>
          );
        })}
        </Svg>
        <Pressable
          testID="line-chart-plot"
          style={[
            styles.plotInteraction,
            {
              left: contentOffsetX + padding.left * contentScale,
              top: contentOffsetY + padding.top * contentScale,
              width: chartWidth * contentScale,
              height: chartHeight * contentScale,
            },
          ]}
          onPress={(event) => selectNearestPoint(event.nativeEvent.locationX)}
          accessibilityRole="adjustable"
          accessibilityLabel={t('chart_accessibility_label')}
          accessibilityHint={t('chart_accessibility_hint')}
          accessibilityValue={{ text: accessibleValue }}
          accessibilityActions={[
            { name: 'decrement', label: t('chart_previous_point') },
            { name: 'increment', label: t('chart_next_point') },
          ]}
          onAccessibilityAction={(event) => {
            if (event.nativeEvent.actionName === 'increment') moveAccessibleSelection(1);
            if (event.nativeEvent.actionName === 'decrement') moveAccessibleSelection(-1);
          }}
        />
        {points.map((point, index) => (
          <Pressable
            key={`hit-target-${index}`}
            testID={`line-chart-hit-target-${index}`}
            style={[
              styles.pointHitTarget,
              {
                left: contentOffsetX + point.x * contentScale - 22,
                top: contentOffsetY + point.y * contentScale - 22,
              },
            ]}
            onPress={() => handlePress(index)}
            accessibilityRole="button"
            accessibilityLabel={[
              data[index].label,
              formatCurrency(data[index].value, currency),
              data[index].meta,
            ].filter(Boolean).join(', ')}
            accessibilityHint={t('chart_point_select_hint')}
          />
        ))}
      </View>
    </View>
  );
}

const getStyles = () => StyleSheet.create({
  container: {
    width: '100%',
    marginVertical: Spacing.sm,
  },
  chartStage: {
    width: '100%',
    position: 'relative',
  },
  plotInteraction: {
    position: 'absolute',
    backgroundColor: 'transparent',
  },
  pointHitTarget: {
    position: 'absolute',
    width: 44,
    height: 44,
    borderRadius: 22,
    backgroundColor: 'transparent',
  },
  emptyText: {
    ...Typography.bodyMedium,
    color: Colors.textMuted,
    textAlign: 'center',
    marginTop: Spacing.xl,
  },
  inspector: {
    minHeight: 46,
    flexDirection: 'row',
    alignItems: 'center',
    marginHorizontal: Spacing.xs,
    marginBottom: Spacing.xs,
    paddingLeft: Spacing.md,
    paddingRight: Spacing.xs,
    backgroundColor: Colors.surfaceLight,
    borderRadius: BorderRadius.md,
    borderWidth: 1,
    borderColor: Colors.border,
  },
  inspectorSelected: {
    backgroundColor: Colors.primaryGlow,
    borderColor: Colors.glassBorder,
  },
  inspectorHint: {
    flex: 1,
    minHeight: 44,
    flexDirection: 'row',
    alignItems: 'center',
    gap: Spacing.sm,
  },
  inspectorHintText: {
    ...Typography.bodySmall,
    color: Colors.textSecondary,
    flex: 1,
  },
  selectionSummary: {
    flex: 1,
    minWidth: 0,
    flexDirection: 'row',
    alignItems: 'center',
    gap: Spacing.sm,
  },
  selectionMarker: {
    width: 7,
    height: 7,
    borderRadius: BorderRadius.round,
    backgroundColor: Colors.primary,
  },
  selectionIdentity: {
    flex: 1,
    minWidth: 0,
  },
  selectionDate: {
    ...Typography.labelSmall,
    color: Colors.textSecondary,
  },
  selectionMeta: {
    ...Typography.bodySmall,
    color: Colors.textPrimary,
    fontFamily: FontFamily.medium,
  },
  selectionValue: {
    ...Typography.amountSmall,
    color: Colors.textPrimary,
    fontFamily: FontFamily.bold,
    marginLeft: Spacing.xs,
  },
  clearButton: {
    width: 40,
    height: 40,
    borderRadius: BorderRadius.round,
    alignItems: 'center',
    justifyContent: 'center',
    marginLeft: Spacing.xs,
  },
  clearButtonPressed: {
    backgroundColor: Colors.divider,
  },
});
