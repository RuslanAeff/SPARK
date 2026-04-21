// S.P.A.R.K. — Interactive Bar Chart Component
// P8: Eskiden `Animated.Value` + `addListener` + `setState` ile her frame’de
// React re-render üretiliyordu. Artık animasyon Reanimated shared value üzerinde
// worklet olarak UI thread’de yürüyor; bar yükseklikleri `useAnimatedProps` ile
// doğrudan SVG Rect öznitelik olarak yazılıyor. Bu 60+ FPS bar grafiğinde JS
// thread yükünü neredeyse sıfıra indirir.
import React, { useEffect, useMemo, useState } from 'react';
import { View, Text, StyleSheet } from 'react-native';
import { useAppTheme } from '../theme/themeStore';
import Svg, { Rect, Line, Text as SvgText, G } from 'react-native-svg';
import Animated, {
  Easing,
  useAnimatedProps,
  useSharedValue,
  withTiming,
  type SharedValue,
} from 'react-native-reanimated';
import { Colors } from '../theme/colors';
import { Typography, FontFamily } from '../theme/typography';
import { Spacing, BorderRadius } from '../theme/spacing';
import { formatCurrency } from '../utils/formatCurrency';
import { useLanguage } from '../i18n/LanguageContext';

const ARect = Animated.createAnimatedComponent(Rect);

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
}

/** Tek bir bar — animasyon değeri UI thread’de worklet içinde çözülür */
function AnimatedBar({
  progress,
  staggerDelay,
  targetBarHeight,
  x,
  barWidth,
  chartBaseY,
  fill,
  opacity,
}: {
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
    const p = progress.value;
    const denom = 1 - staggerDelay * 0.5;
    const local = denom > 0 ? Math.max(0, Math.min(1, (p - staggerDelay * 0.5) / denom)) : p;
    const h = Math.max(targetBarHeight * local, 2);
    const y = chartBaseY - h;
    return { height: h, y } as any;
  }, [targetBarHeight, chartBaseY, staggerDelay]);

  return (
    <ARect
      animatedProps={animatedProps}
      x={x}
      width={barWidth}
      fill={fill}
      opacity={opacity}
      rx={barWidth / 2}
    />
  );
}

export default function BarChart({
  data,
  prevData,
  height = 180,
  defaultColor = Colors.primary,
  currency = 'PLN',
}: BarChartProps) {
  const scheme = useAppTheme();
  // P10: StyleSheet.create her render’da yeniden çalışmasın; sadece tema geçişinde
  // yeniden oluştur. Colors proxy tema şemasına göre çözüldüğünden `scheme` deps
  // olarak yeterli.
  const styles = useMemo(() => getStyles(), [scheme]);
  const { t } = useLanguage();
  const [selectedIndex, setSelectedIndex] = useState<number | null>(null);

  const progress = useSharedValue(0);

  // Animasyon tetikleyicisi: data değiştiğinde 0 → 1 yumuşak geçiş.
  // Not: shared value deps array’e eklenmez; referansı kararlıdır.
  useEffect(() => {
    setSelectedIndex(null);
    progress.value = 0;
    progress.value = withTiming(1, {
      duration: 700,
      easing: Easing.out(Easing.cubic),
    });
  }, [data, progress]);

  const width = 320;
  const padding = { top: 20, right: 10, bottom: 24, left: 40 };
  const chartWidth = width - padding.left - padding.right;
  const chartHeight = height - padding.top - padding.bottom;
  const chartBaseY = padding.top + chartHeight;

  if (data.length === 0) {
    return (
      <View style={[styles.container, { height }]}>
        <Text style={styles.emptyText}>{t('no_data_found')}</Text>
      </View>
    );
  }

  const values = data.map(d => d.value);
  const prevValues = prevData ? prevData.map(d => d.value) : [];
  const allMax = Math.max(...values, ...prevValues, 10);
  const maxVal = allMax;

  const totalBars = data.length;
  const idealBarWidth = Math.min(30, Math.max(4, (chartWidth / totalBars) * 0.7));
  const spacePerBar = chartWidth / totalBars;
  const gap = spacePerBar - idealBarWidth;

  const handlePress = (index: number) => {
    setSelectedIndex(index === selectedIndex ? null : index);
  };

  const formatYLabel = (v: number) => {
    if (v >= 1000) return `${(v / 1000).toFixed(1)}K`;
    return v.toFixed(0);
  };

  return (
    <View style={[styles.container, { height }]}>
      <Svg
        width="100%"
        height={height}
        viewBox={`0 0 ${width} ${height}`}
        preserveAspectRatio="xMidYMid meet"
      >
        {[0, 0.5, 1].map((ratio, i) => {
          const y = padding.top + chartHeight * (1 - ratio);
          return (
            <G key={`grid-${i}`}>
              <Line
                x1={padding.left} y1={y} x2={width - padding.right} y2={y}
                stroke={Colors.divider} strokeWidth={1} strokeDasharray="4,4"
              />
              <SvgText
                x={padding.left - 6} y={y + 4} fontSize="10"
                fill={Colors.textMuted} textAnchor="end" fontFamily={FontFamily.regular}
              >
                {formatYLabel(maxVal * ratio)}
              </SvgText>
            </G>
          );
        })}

        {/* Previous period ghost bars */}
        {prevData && prevData.length === data.length && data.map((_, i) => {
          const pVal = prevData[i]?.value || 0;
          const barH = (pVal / maxVal) * chartHeight;
          const x = padding.left + (i * spacePerBar) + (gap / 2);
          const y = padding.top + chartHeight - barH;
          return (
            <Rect
              key={`prev-${i}`}
              x={x} y={y} width={idealBarWidth}
              height={Math.max(barH, 0)}
              fill={Colors.textMuted} opacity={0.18}
              rx={idealBarWidth / 2}
            />
          );
        })}

        {/* Current bars — animasyon UI thread’de */}
        {data.map((d, i) => {
          const staggerDelay = i / totalBars;
          const targetBarHeight = (d.value / maxVal) * chartHeight;
          const x = padding.left + (i * spacePerBar) + (gap / 2);
          const isSelected = selectedIndex === i;
          const fill = isSelected ? Colors.secondary : (d.color || defaultColor);
          const opacity = selectedIndex !== null && !isSelected ? 0.3 : 1;

          return (
            <G key={`bar-${i}`} onPress={() => handlePress(i)}>
              <AnimatedBar
                progress={progress}
                staggerDelay={staggerDelay}
                targetBarHeight={targetBarHeight}
                x={x}
                barWidth={idealBarWidth}
                chartBaseY={chartBaseY}
                fill={fill}
                opacity={opacity}
              />
              <Rect
                x={x - gap / 2} y={padding.top}
                width={spacePerBar} height={chartHeight}
                fill="transparent"
              />
            </G>
          );
        })}

        {data.map((d, i) => {
          const showLabel =
            totalBars <= 7 || i === 0 || i === totalBars - 1 || i % Math.ceil(totalBars / 5) === 0;
          if (!showLabel) return null;
          const x = padding.left + (i * spacePerBar) + (spacePerBar / 2);
          return (
            <SvgText
              key={`xlabel-${i}`} x={x} y={height - 6}
              fontSize="10" fill={Colors.textSecondary}
              textAnchor="middle" fontFamily={FontFamily.medium}
            >
              {d.label}
            </SvgText>
          );
        })}
      </Svg>

      {selectedIndex !== null && data[selectedIndex] && (
        <View style={styles.tooltip}>
          <Text style={styles.tooltipLabel}>{data[selectedIndex].label}</Text>
          <Text style={styles.tooltipValue}>
            {formatCurrency(data[selectedIndex].value, currency, false)}
          </Text>
          {prevData && prevData[selectedIndex] && prevData[selectedIndex].value > 0 && (
            <Text style={[styles.tooltipPrev, {
              color: data[selectedIndex].value <= prevData[selectedIndex].value
                ? Colors.success
                : Colors.danger,
            }]}>
              {t('last_period')}: {formatCurrency(prevData[selectedIndex].value, currency, false)}
            </Text>
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
    top: -10,
    alignSelf: 'center',
    backgroundColor: Colors.surfaceElevated,
    paddingHorizontal: Spacing.md,
    paddingVertical: Spacing.xs,
    borderRadius: BorderRadius.md,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 4 },
    shadowOpacity: 0.15,
    shadowRadius: 8,
    elevation: 4,
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
  tooltipPrev: {
    ...Typography.labelSmall,
    marginTop: 2,
  },
});
