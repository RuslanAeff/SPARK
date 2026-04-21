// S.P.A.R.K. — Bezier Line Chart Component (Price History)
import React, { useMemo, useState } from 'react';
import { View, Text, StyleSheet } from 'react-native';
import Svg, { Path, Circle, Line, G, Defs, LinearGradient, Stop, Rect, Text as SvgText } from 'react-native-svg';
import { Colors } from '../theme/colors';
import { useAppTheme } from '../theme/themeStore';
import { Typography, FontFamily } from '../theme/typography';
import { Spacing, BorderRadius } from '../theme/spacing';
import { formatCurrency } from '../utils/formatCurrency';
import { useLanguage } from '../i18n/LanguageContext';

export interface LinePoint {
  label: string;
  value: number;
  meta?: string; // optional tooltip extra info
}

interface LineChartProps {
  data: LinePoint[];
  height?: number;
  color?: string;
  currency?: string;
  showDots?: boolean;
}

export default function LineChart({
  data,
  height = 160,
  color = Colors.primary,
  currency = 'PLN',
  showDots = true,
}: LineChartProps) {
  const scheme = useAppTheme();
  const styles = useMemo(() => getStyles(), [scheme]);
  const { t } = useLanguage();
  const [selectedIndex, setSelectedIndex] = useState<number | null>(null);

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

  // Map data to pixel coordinates
  const points = data.map((d, i) => ({
    x: padding.left + (i / Math.max(data.length - 1, 1)) * chartWidth,
    y: padding.top + chartHeight - ((d.value - yMin) / yRange) * chartHeight,
  }));

  // Build smooth bezier path
  const buildPath = (): string => {
    if (points.length < 2) {
      return `M ${points[0].x} ${points[0].y}`;
    }
    let path = `M ${points[0].x} ${points[0].y}`;
    for (let i = 0; i < points.length - 1; i++) {
      const curr = points[i];
      const next = points[i + 1];
      const cpx = (curr.x + next.x) / 2;
      path += ` C ${cpx} ${curr.y}, ${cpx} ${next.y}, ${next.x} ${next.y}`;
    }
    return path;
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
    if (v >= 1000) return `${(v / 1000).toFixed(1)}K`;
    if (v >= 100) return v.toFixed(0);
    return v.toFixed(2);
  };

  const handlePress = (index: number) => {
    setSelectedIndex(index === selectedIndex ? null : index);
  };

  return (
    <View style={[styles.container, { height }]}>
      <Svg width="100%" height={height} viewBox={`0 0 ${width} ${height}`} preserveAspectRatio="xMidYMid meet">
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

        {/* Data Points (Dots) */}
        {showDots && points.map((p, i) => {
          const isSelected = selectedIndex === i;
          return (
            <G key={`dot-${i}`} onPress={() => handlePress(i)}>
              {/* Invisible press target */}
              <Rect
                x={p.x - 14}
                y={p.y - 14}
                width={28}
                height={28}
                fill="transparent"
              />
              {isSelected && (
                <Circle
                  cx={p.x}
                  cy={p.y}
                  r={8}
                  fill={color}
                  opacity={0.2}
                />
              )}
              <Circle
                cx={p.x}
                cy={p.y}
                r={isSelected ? 5 : 3.5}
                fill={isSelected ? Colors.background : color}
                stroke={color}
                strokeWidth={isSelected ? 2.5 : 1.5}
              />
            </G>
          );
        })}

        {/* X Axis Labels */}
        {data.map((d, i) => {
          const total = data.length;
          const show = total <= 6 || i === 0 || i === total - 1 || i % Math.ceil(total / 4) === 0;
          if (!show) return null;
          return (
            <SvgText
              key={`xl-${i}`}
              x={points[i].x}
              y={height - 6}
              fontSize="9"
              fill={Colors.textSecondary}
              textAnchor="middle"
              fontFamily={FontFamily.medium}
            >
              {d.label}
            </SvgText>
          );
        })}
      </Svg>

      {/* Tooltip */}
      {selectedIndex !== null && data[selectedIndex] && (
        <View style={styles.tooltip}>
          <Text style={styles.tooltipLabel}>{data[selectedIndex].label}</Text>
          <Text style={styles.tooltipValue}>
            {formatCurrency(data[selectedIndex].value, currency, false)}
          </Text>
          {data[selectedIndex].meta && (
            <Text style={styles.tooltipMeta}>{data[selectedIndex].meta}</Text>
          )}
        </View>
      )}
    </View>
  );
}

const getStyles = () => StyleSheet.create({
  container: {
    width: '100%',
    position: 'relative',
    marginVertical: Spacing.sm,
  },
  emptyText: {
    ...Typography.bodyMedium,
    color: Colors.textMuted,
    textAlign: 'center',
    marginTop: Spacing.xl,
  },
  tooltip: {
    position: 'absolute',
    top: -8,
    alignSelf: 'center',
    backgroundColor: Colors.surfaceElevated,
    paddingHorizontal: Spacing.md,
    paddingVertical: Spacing.xs,
    borderRadius: BorderRadius.md,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 4 },
    shadowOpacity: 0.2,
    shadowRadius: 8,
    elevation: 5,
    borderWidth: 1,
    borderColor: Colors.border,
    alignItems: 'center',
  },
  tooltipLabel: {
    ...Typography.labelSmall,
    color: Colors.textSecondary,
    marginBottom: 2,
  },
  tooltipValue: {
    ...Typography.labelLarge,
    color: Colors.textPrimary,
    fontFamily: FontFamily.bold,
  },
  tooltipMeta: {
    ...Typography.labelSmall,
    color: Colors.textMuted,
    marginTop: 2,
  },
});
