// S.P.A.R.K. — Spending Trend Line Chart
import React, { useMemo } from 'react';
import { View, Text, StyleSheet } from 'react-native';
import Svg, { Path, Line, Circle as SvgCircle } from 'react-native-svg';
import { Colors } from '../theme/colors';
import { Typography, FontFamily } from '../theme/typography';
import { Spacing } from '../theme/spacing';
import { useLanguage } from '../i18n/LanguageContext';
import { useAppTheme } from '../theme/themeStore';

interface SpendingTrendProps {
  data: { label: string; value: number }[];
  height?: number;
  color?: string;
}

export default function SpendingTrend({
  data,
  height = 120,
  color = Colors.textPrimary,
}: SpendingTrendProps) {
  const scheme = useAppTheme();
  const styles = useMemo(() => getStyles(), [scheme]);
  const { t } = useLanguage();
  const width = 320; // will be stretched by container
  const padding = { top: 10, right: 60, bottom: 24, left: 8 };
  const chartWidth = width - padding.left - padding.right;
  const chartHeight = height - padding.top - padding.bottom;

  const { path, maxVal, minVal, points } = useMemo(() => {
    if (data.length === 0) return { path: '', maxVal: 0, minVal: 0, points: [] };
    
    const values = data.map(d => d.value);
    const max = Math.max(...values, 1);
    const min = Math.min(...values, 0);
    const range = max - min || 1;

    const pts = data.map((d, i) => ({
      x: padding.left + (i / Math.max(data.length - 1, 1)) * chartWidth,
      y: padding.top + chartHeight - ((d.value - min) / range) * chartHeight,
      value: d.value,
    }));

    // Create smooth curve using cubic bezier
    let pathStr = `M ${pts[0].x} ${pts[0].y}`;
    for (let i = 1; i < pts.length; i++) {
      const prev = pts[i - 1];
      const curr = pts[i];
      const cpx1 = prev.x + (curr.x - prev.x) * 0.4;
      const cpx2 = curr.x - (curr.x - prev.x) * 0.4;
      pathStr += ` C ${cpx1} ${prev.y}, ${cpx2} ${curr.y}, ${curr.x} ${curr.y}`;
    }

    return { path: pathStr, maxVal: max, minVal: min, points: pts };
  }, [data, chartWidth, chartHeight]);

  if (data.length === 0) {
    return (
      <View style={[styles.container, { height }]}>
        <Text style={styles.emptyText}>{t('no_data_yet')}</Text>
      </View>
    );
  }

  const formatValue = (v: number) => {
    if (v >= 1000) return `${(v / 1000).toFixed(0)}K`;
    return v.toFixed(0);
  };

  return (
    <View style={[styles.container, { height }]}>
      <Svg width="100%" height={height} viewBox={`0 0 ${width} ${height}`} preserveAspectRatio="none">
        {/* Grid lines */}
        <Line
          x1={padding.left} y1={padding.top}
          x2={width - padding.right} y2={padding.top}
          stroke={Colors.divider} strokeWidth={0.5} strokeDasharray="4,4"
        />
        <Line
          x1={padding.left} y1={padding.top + chartHeight / 2}
          x2={width - padding.right} y2={padding.top + chartHeight / 2}
          stroke={Colors.divider} strokeWidth={0.5} strokeDasharray="4,4"
        />
        <Line
          x1={padding.left} y1={padding.top + chartHeight}
          x2={width - padding.right} y2={padding.top + chartHeight}
          stroke={Colors.divider} strokeWidth={0.5} strokeDasharray="4,4"
        />

        {/* Curve */}
        <Path
          d={path}
          stroke={color}
          strokeWidth={2}
          fill="none"
        />

        {/* End dot */}
        {points.length > 0 && (
          <SvgCircle
            cx={points[points.length - 1].x}
            cy={points[points.length - 1].y}
            r={4}
            fill={color}
          />
        )}
      </Svg>

      {/* Y-axis labels */}
      <View style={styles.yLabels}>
        <Text style={styles.yLabel}>{formatValue(maxVal)}</Text>
        <Text style={styles.yLabel}>{formatValue((maxVal + minVal) / 2)}</Text>
        <Text style={styles.yLabel}>{formatValue(minVal)}</Text>
      </View>

      {/* X-axis labels */}
      <View style={styles.xLabels}>
        {data.map((d, i) => (
          <Text key={i} style={styles.xLabel}>{d.label}</Text>
        ))}
      </View>
    </View>
  );
}

const getStyles = () => StyleSheet.create({
  container: {
    position: 'relative',
  },
  emptyText: {
    ...Typography.bodySmall,
    color: Colors.textMuted,
    textAlign: 'center',
    marginTop: 40,
  },
  yLabels: {
    position: 'absolute',
    right: 0,
    top: 4,
    bottom: 24,
    justifyContent: 'space-between',
    width: 55,
  },
  yLabel: {
    ...Typography.labelSmall,
    color: Colors.textSecondary,
    textAlign: 'right',
    fontSize: 10,
  },
  xLabels: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    paddingLeft: 8,
    paddingRight: 60,
    position: 'absolute',
    bottom: 0,
    left: 0,
    right: 0,
  },
  xLabel: {
    ...Typography.labelSmall,
    color: Colors.textSecondary,
    fontSize: 10,
  },
});
