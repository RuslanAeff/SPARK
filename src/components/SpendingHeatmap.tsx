import React, { useMemo } from 'react';
import { View, Text, StyleSheet, Pressable } from 'react-native';
import { Colors } from '../theme/colors';
import { Typography, FontFamily } from '../theme/typography';
import { Spacing, BorderRadius } from '../theme/spacing';
import { formatCurrency } from '../utils/formatCurrency';
import { useLanguage } from '../i18n/LanguageContext';
import { useCurrency } from '../context/CurrencyContext';
import { useAppTheme } from '../theme/themeStore';

interface HeatmapProps {
  data: { date: string; total: number }[];
  year: number;
  month: number;
}

export default function SpendingHeatmap({ data, year, month }: HeatmapProps) {
  const { t } = useLanguage();
  const { currency } = useCurrency();
  const scheme = useAppTheme();
  const styles = useMemo(() => getStyles(), [scheme]);

  const { rows, maxTotal, spendingMap, todayStr } = useMemo(() => {
    const firstDay = new Date(year, month - 1, 1);
    const daysInMonth = new Date(year, month, 0).getDate();
    const startDow = (firstDay.getDay() + 6) % 7;

    const sMap = new Map<string, number>();
    let mx = 1;
    data.forEach(d => {
      sMap.set(d.date, d.total);
      if (d.total > mx) mx = d.total;
    });

    const cells: ({ day: number; date: string } | null)[] = [];
    for (let i = 0; i < startDow; i++) cells.push(null);
    for (let d = 1; d <= daysInMonth; d++) {
      const dateStr = `${year}-${String(month).padStart(2, '0')}-${String(d).padStart(2, '0')}`;
      cells.push({ day: d, date: dateStr });
    }
    while (cells.length % 7 !== 0) cells.push(null);

    const r: (typeof cells)[] = [];
    for (let i = 0; i < cells.length; i += 7) {
      r.push(cells.slice(i, i + 7));
    }

    const now = new Date();
    const tStr = `${now.getFullYear()}-${String(now.getMonth() + 1).padStart(2, '0')}-${String(now.getDate()).padStart(2, '0')}`;

    return { rows: r, maxTotal: mx, spendingMap: sMap, todayStr: tStr };
  }, [data, year, month]);

  const [selected, setSelected] = React.useState<string | null>(null);

  const getIntensity = (total: number): number => {
    if (total === 0) return 0;
    return Math.min(4, Math.ceil((total / maxTotal) * 4));
  };

  const intensityColors = [
    Colors.surfaceLight,
    Colors.primary + '25',
    Colors.primary + '50',
    Colors.primary + '80',
    Colors.primary,
  ];

  const dayLabels = [
    t('weekday_mon'), t('weekday_tue'), t('weekday_wed'),
    t('weekday_thu'), t('weekday_fri'), t('weekday_sat'), t('weekday_sun'),
  ];

  return (
    <View>
      <View style={styles.dayHeader}>
        {dayLabels.map((d, i) => (
          <View key={i} style={styles.dayHeaderCell}>
            <Text style={[styles.dayLabel, (i === 5 || i === 6) && { color: Colors.primary + '88' }]}>{d}</Text>
          </View>
        ))}
      </View>

      {rows.map((row, ri) => (
        <View key={ri} style={styles.row}>
          {row.map((cell, ci) => {
            if (!cell) return <View key={ci} style={styles.emptyCell} />;
            const total = spendingMap.get(cell.date) || 0;
            const intensity = getIntensity(total);
            const isToday = cell.date === todayStr;
            const isSelected = cell.date === selected;

            return (
              <Pressable
                key={ci}
                onPress={() => setSelected(isSelected ? null : cell.date)}
                style={[
                  styles.cell,
                  { backgroundColor: intensityColors[intensity] },
                  isToday && styles.todayCell,
                  isSelected && styles.selectedCell,
                ]}
              >
                <Text style={[
                  styles.cellDay,
                  intensity >= 3 && { color: '#fff' },
                  isToday && { fontFamily: FontFamily.bold, color: Colors.primary },
                  isSelected && intensity >= 3 && { color: '#fff' },
                ]}>
                  {cell.day}
                </Text>
              </Pressable>
            );
          })}
        </View>
      ))}

      {selected && spendingMap.has(selected) && (
        <View style={styles.tooltip}>
          <Text style={styles.tooltipDate}>{selected.split('-').reverse().join('.')}</Text>
          <Text style={styles.tooltipAmount}>{formatCurrency(spendingMap.get(selected) || 0, currency)}</Text>
        </View>
      )}

      <View style={styles.legend}>
        <Text style={styles.legendLabel}>{t('heatmap_less')}</Text>
        {intensityColors.map((c, i) => (
          <View key={i} style={[styles.legendBox, { backgroundColor: c }]} />
        ))}
        <Text style={styles.legendLabel}>{t('heatmap_more')}</Text>
      </View>
    </View>
  );
}

const getStyles = () => StyleSheet.create({
  dayHeader: {
    flexDirection: 'row',
    marginBottom: 4,
  },
  dayHeaderCell: {
    flex: 1,
    alignItems: 'center',
  },
  dayLabel: {
    fontSize: 10,
    fontFamily: FontFamily.medium,
    color: Colors.textMuted,
  },
  row: {
    flexDirection: 'row',
    gap: 3,
    marginBottom: 3,
  },
  cell: {
    flex: 1,
    aspectRatio: 1,
    borderRadius: BorderRadius.sm,
    alignItems: 'center',
    justifyContent: 'center',
  },
  emptyCell: {
    flex: 1,
    aspectRatio: 1,
  },
  todayCell: {
    borderWidth: 1.5,
    borderColor: Colors.cardBorder,
  },
  selectedCell: {
    borderWidth: 2,
    borderColor: Colors.secondary,
  },
  cellDay: {
    fontSize: 11,
    fontFamily: FontFamily.regular,
    color: Colors.textSecondary,
  },
  tooltip: {
    flexDirection: 'row',
    justifyContent: 'center',
    alignItems: 'center',
    gap: Spacing.sm,
    paddingVertical: Spacing.sm,
    marginTop: Spacing.xs,
    backgroundColor: Colors.surfaceElevated,
    borderRadius: BorderRadius.md,
    borderWidth: 1,
    borderColor: Colors.border,
  },
  tooltipDate: {
    ...Typography.labelSmall,
    color: Colors.textSecondary,
  },
  tooltipAmount: {
    ...Typography.labelMedium,
    fontFamily: FontFamily.bold,
    color: Colors.textPrimary,
  },
  legend: {
    flexDirection: 'row',
    justifyContent: 'center',
    alignItems: 'center',
    marginTop: Spacing.sm,
    gap: 4,
  },
  legendLabel: {
    fontSize: 10,
    fontFamily: FontFamily.medium,
    color: Colors.textMuted,
    marginHorizontal: 2,
  },
  legendBox: {
    width: 14,
    height: 14,
    borderRadius: 3,
  },
});
